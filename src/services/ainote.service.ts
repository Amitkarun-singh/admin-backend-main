import sequelize from "../config/db.js";
import { uploadToS3 }      from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";
import {
  requiresStream,
  findDistinctLanguages,
  findDistinctBoards,
  findDistinctClasses,
  findDistinctStreams,
  findDistinctSubjects,
  findDistinctChapters,
  findNotes,
  createNote,
} from "../repositories/ainote.repository.ts";
import type { FindNotesFilters } from "../repositories/ainote.repository.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAiNotesPayload {
  language: string;
  board: string;
  className: string;
  subject: string;
  stream?: string | null;
  chapterList: string[];
  shortNotesList?: (string | null)[];
  noteIndices?: number[];
  bookIndices?: number[];
  noteFiles?: Express.Multer.File[];
  bookFiles?: Express.Multer.File[];
  created_by?: string;
}

export interface CreateNoteResult {
  index: number;
  topic: string;
  noteKey: string | null;
  bookKey: string | null;
  id: number;
}

export interface EnrichedNote {
  id: number;
  language: string;
  board: string;
  stream?: string | null;
  class: string;
  subject: string;
  topic: string;
  short_notes?: string | null;
  full_notes?: string | null;
  book_url?: string | null;
  created_by?: string;
  pdfUrl: string | null;
  bookUrl: string | null;
}

export class ValidationError extends Error {
  public readonly status: 400;
  constructor(message: string) {
    super(message);
    this.name   = "ValidationError";
    this.status = 400;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Service methods
// ─────────────────────────────────────────────────────────────────────────────

export async function getLanguages(): Promise<string[]> {
  return findDistinctLanguages();
}

export async function getBoards(language: string): Promise<string[]> {
  assert(language, "language is required");
  return findDistinctBoards(language);
}

export async function getClasses(language: string, board: string): Promise<string[]> {
  assert(language && board, "language and board are required");
  return findDistinctClasses(language, board);
}

export async function getStreams(language: string, board: string): Promise<string[]> {
  assert(language && board, "language and board are required");
  return findDistinctStreams(language, board);
}

export async function getSubjects(
  language: string,
  board: string,
  className: string,
  stream?: string | null
): Promise<string[]> {
  assert(language && board && className, "language, board and class are required");
  assert(
    !requiresStream(className) || stream,
    "stream is required for class 11 and 12"
  );
  return findDistinctSubjects(language, board, className, stream);
}

export async function getChapters(
  language: string,
  board: string,
  className: string,
  subject: string,
  stream?: string | null
): Promise<string[]> {
  assert(
    language && board && className && subject,
    "language, board, class and subject are required"
  );
  assert(
    !requiresStream(className) || stream,
    "stream is required for class 11 and 12"
  );
  return findDistinctChapters(language, board, className, subject, stream);
}

export async function getAiNotes(filters: FindNotesFilters): Promise<EnrichedNote[]> {
  const notes = await findNotes(filters);

  return Promise.all(
    notes.map(async (note): Promise<EnrichedNote> => {
      const [pdfUrl, bookUrl] = await Promise.all([
        getSignedPdfUrl(note.full_notes),
        getSignedPdfUrl(note.book_url),
      ]);
      return { ...note.toJSON(), pdfUrl, bookUrl };
    })
  );
}

export async function createAiNotes(
  payload: CreateAiNotesPayload
): Promise<CreateNoteResult[]> {
  const {
    language,
    board,
    className,
    subject,
    stream,
    chapterList,
    shortNotesList = [],
    noteIndices    = [],
    bookIndices    = [],
    noteFiles      = [],
    bookFiles      = [],
    created_by     = "AI",
  } = payload;

  // ── Validation ────────────────────────────────────────────────────────────
  assert(
    language && board && className && subject && chapterList?.length,
    "language, board, class, subject and chapters are required"
  );
  assert(
    !requiresStream(className) || stream,
    "stream is required for class 11 and 12"
  );
  assert(
    requiresStream(className) || !stream,
    `stream must not be provided for class ${className}`
  );
  assert(
    noteFiles.length === noteIndices.length,
    `noteChapterIndices length (${noteIndices.length}) must match notes file count (${noteFiles.length})`
  );
  assert(
    bookFiles.length === bookIndices.length,
    `bookChapterIndices length (${bookIndices.length}) must match books file count (${bookFiles.length})`
  );

  for (const idx of noteIndices) {
    assert(
      idx >= 0 && idx < chapterList.length,
      `noteChapterIndices contains out-of-range index ${idx} (chapters length: ${chapterList.length})`
    );
  }
  for (const idx of bookIndices) {
    assert(
      idx >= 0 && idx < chapterList.length,
      `bookChapterIndices contains out-of-range index ${idx} (chapters length: ${chapterList.length})`
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  const resolvedStream: string | null = requiresStream(className) ? (stream ?? null) : null;

  const noteFileMap = new Map<number, Express.Multer.File>(
    noteIndices.map((chIdx, fileIdx) => [chIdx, noteFiles[fileIdx]])
  );
  const bookFileMap = new Map<number, Express.Multer.File>(
    bookIndices.map((chIdx, fileIdx) => [chIdx, bookFiles[fileIdx]])
  );

  // ── Transaction ───────────────────────────────────────────────────────────
  const transaction = await sequelize.transaction();
  const results: CreateNoteResult[] = [];

  try {
    for (let i = 0; i < chapterList.length; i++) {
      const topic      = chapterList[i].trim();
      const shortNotes = shortNotesList[i] ?? null;
      const noteFile   = noteFileMap.get(i) ?? null;
      const bookFile   = bookFileMap.get(i) ?? null;

      let noteKey: string | null = null;
      let bookKey: string | null = null;

      if (bookFile) {
        const { key } = await uploadToS3(bookFile, "Books", language, board, className, subject, topic);
        bookKey = key;
        console.log(`✅ Book uploaded for chapter [${i}] "${topic}":`, bookKey);
      }

      if (noteFile) {
        const { key } = await uploadToS3(noteFile, "Notes", language, board, className, subject, topic);
        noteKey = key;
        console.log(`✅ Note uploaded for chapter [${i}] "${topic}":`, noteKey);
      }

      const note = await createNote(
        {
          language,
          board,
          stream:      resolvedStream,
          class:       className,
          subject,
          topic,
          short_notes: shortNotes,
          full_notes:  noteKey,
          book_url:    bookKey,
          created_by,
        },
        transaction
      );

      results.push({ index: i, topic, noteKey, bookKey, id: note.id });
      await sleep(500);
    }

    await transaction.commit();
    return results;

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
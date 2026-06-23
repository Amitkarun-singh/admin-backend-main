import sequelize from "../config/db.js";
import { uploadToS3 }      from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";
import curriculumService   from "./curriculum.service.ts";
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
  chapter_id: number | null;
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
  chapter_id?: number | null;
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
// Chapter ID resolver
//
// Walks the curriculum filter chain ONCE for the whole batch:
//   language → board → class → stream (if needed) → subject → all chapters
//
// Returns a closure that maps chapter name → chapter_id using the pre-fetched
// data. Zero extra HTTP calls inside the per-chapter loop.
// ─────────────────────────────────────────────────────────────────────────────

async function buildChapterIdResolver(
  language:  string,
  board:     string,
  className: string,
  stream:    string | null,
  subject:   string
): Promise<(chapterName: string) => number | null> {

  // ── Step 1: resolve language id ───────────────────────────────────────────
  const langsRes = await curriculumService.lang();
  const langObj  = (langsRes.data ?? []).find(
    (l: any) => l.name?.toLowerCase() === language.toLowerCase()
  );
  if (!langObj) {
    console.warn(`⚠️ Chapter ID resolver: language "${language}" not found in curriculum`);
    return () => null;
  }

  // ── Step 2: resolve class id (matched by slug = class number e.g. "11") ───
  const classesRes = await curriculumService.allClass();
  const classObj   = (classesRes.data ?? []).find(
    (c: any) => String(c.slug) === String(className)
  );
  if (!classObj) {
    console.warn(`⚠️ Chapter ID resolver: class "${className}" not found in curriculum`);
    return () => null;
  }
  const classId: number = classObj.id;

  // ── Step 3: resolve stream id (null / 0 for class 1–10) ──────────────────
  let streamId: number = 0;
  if (requiresStream(className) && stream) {
    const streamsRes = await curriculumService.stream();
    const streamObj  = (streamsRes.data ?? []).find(
      (s: any) => s.name?.toLowerCase() === stream.toLowerCase()
    );
    if (!streamObj) {
      console.warn(`⚠️ Chapter ID resolver: stream "${stream}" not found in curriculum`);
      return () => null;
    }
    streamId = streamObj.id;
  }

  // ── Step 4: resolve subject id ────────────────────────────────────────────
  const subjectsRes = await curriculumService.allSubject(classId, board, streamId);
  const subjectObj  = (subjectsRes.data ?? []).find(
    (s: any) => s.name?.toLowerCase() === subject.toLowerCase()
  );
  if (!subjectObj) {
    console.warn(`⚠️ Chapter ID resolver: subject "${subject}" not found in curriculum`);
    return () => null;
  }
  const subjectId: number = subjectObj.id;

  // ── Step 5: fetch ALL chapters for this subject at once ───────────────────
  const chaptersRes = await curriculumService.allChapter({
    classId,
    board,
    streamId,
    subjectId,
    lang: language,
  });

  // Build a case-insensitive name → id map
  const chapterMap = new Map<string, number>();
  for (const ch of chaptersRes.data ?? []) {
    // curriculum may use "name", "chapter_name", or "title" — cover all
    const name: string | undefined = ch.name ?? ch.chapter_name ?? ch.title;
    if (name && ch.id) {
      chapterMap.set(name.toLowerCase(), ch.id);
    }
  }

  console.log(
    `📚 Chapter ID resolver ready: ${chapterMap.size} chapters loaded` +
    ` for ${subject} | class ${className}${stream ? ` | ${stream}` : ""}`
  );

  // ── Return resolver closure (no more HTTP calls after this) ───────────────
  return (chapterName: string): number | null => {
    const id = chapterMap.get(chapterName.trim().toLowerCase()) ?? null;
    if (id === null) {
      console.warn(`⚠️ Chapter ID resolver: chapter "${chapterName}" not matched`);
    }
    return id;
  };
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

  // ── Resolve chapter IDs once for the entire batch (4–5 HTTP calls total) ──
  let resolveChapterId: (name: string) => number | null = () => null;
  try {
    resolveChapterId = await buildChapterIdResolver(
      language,
      board,
      className,
      resolvedStream,
      subject
    );
  } catch (err) {
    // Non-fatal: upload proceeds, chapter_id will be null for all rows
    console.warn("⚠️ Chapter ID resolution failed, storing null for chapter_id:", err);
  }

  // ── Transaction ───────────────────────────────────────────────────────────
  const transaction = await sequelize.transaction();
  const results: CreateNoteResult[] = [];

  try {
    for (let i = 0; i < chapterList.length; i++) {
      const topic      = chapterList[i].trim();
      const shortNotes = shortNotesList[i] ?? null;
      const noteFile   = noteFileMap.get(i) ?? null;
      const bookFile   = bookFileMap.get(i) ?? null;

      // Resolved from in-memory map — no HTTP call
      const chapterId  = resolveChapterId(topic);

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
          chapter_id:  chapterId,
        },
        transaction
      );

      results.push({ index: i, topic, noteKey, bookKey, id: note.id, chapter_id: chapterId });
      await sleep(500);
    }

    await transaction.commit();
    return results;

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
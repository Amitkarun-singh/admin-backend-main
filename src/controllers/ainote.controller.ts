import fs from "fs";
import { Request, Response } from "express";
import * as AiNoteService from "../services/ainote.service.ts";
import { ValidationError } from "../services/ainote.service.ts";
import type {
  CreateAiNotesPayload,
  CreateNoteResult,
  EnrichedNote,
} from "../services/ainote.service.ts";
import type { FindNotesFilters } from "../repositories/ainote.repository.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types (controller-only, no need to export)
// ─────────────────────────────────────────────────────────────────────────────

interface AiNoteFiles {
  notes?: Express.Multer.File[];
  books?: Express.Multer.File[];
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  results?: T;
}

interface CreateAiNotesBody {
  language: string;
  board: string;
  class: string;
  subject: string;
  stream?: string;
  chapters: string;
  short_notes?: string;
  noteChapterIndices?: string;
  bookChapterIndices?: string;
  created_by?: string;
}

type BoardsRequest   = Request<{}, {}, {}, { language: string }>;
type ClassesRequest  = Request<{}, {}, {}, { language: string; board: string }>;
type StreamsRequest  = Request<{}, {}, {}, { language: string; board: string }>;
type SubjectsRequest = Request<{}, {}, {}, { language: string; board: string; class: string; stream?: string }>;
type ChaptersRequest = Request<{}, {}, {}, { language: string; board: string; class: string; subject: string; stream?: string }>;
type NotesRequest    = Request<{}, {}, {}, FindNotesFilters>;
type CreateAiNotesRequest = Request<{}, {}, CreateAiNotesBody, {}> & { files: AiNoteFiles };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanupTempFiles(files: AiNoteFiles | undefined): void {
  if (!files) return;
  const allFiles: Express.Multer.File[] = [
    ...(files.notes ?? []),
    ...(files.books  ?? []),
  ];
  for (const file of allFiles) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️ Deleted temp file: ${file.path}`);
      }
    } catch (err) {
      console.warn(`⚠️ Could not delete temp file ${file.path}:`, (err as Error).message);
    }
  }
}

function handleError(res: Response, error: unknown, context: string): void {
  console.error(`${context} Error:`, error);
    if (error instanceof ValidationError) {
    res.status(400).json({ success: false, message: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  res.status(500).json({ success: false, message });
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

export const getLanguages = async (
  _req: Request,
  res:  Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const data = await AiNoteService.getLanguages();
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Languages");
  }
};

export const getBoards = async (
  req: BoardsRequest,
  res: Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const data = await AiNoteService.getBoards(req.query.language);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Boards");
  }
};

export const getClasses = async (
  req: ClassesRequest,
  res: Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const { language, board } = req.query;
    const data = await AiNoteService.getClasses(language, board);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Classes");
  }
};

export const getStreams = async (
  req: StreamsRequest,
  res: Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const { language, board } = req.query;
    const data = await AiNoteService.getStreams(language, board);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Streams");
  }
};

export const getSubjects = async (
  req: SubjectsRequest,
  res: Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const { language, board, class: className, stream } = req.query;
    console.log("Get Subjects Query:", req.query);
    const data = await AiNoteService.getSubjects(language, board, className, stream);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Subjects");
  }
};

export const getChapters = async (
  req: ChaptersRequest,
  res: Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const { language, board, class: className, subject, stream } = req.query;
    const data = await AiNoteService.getChapters(language, board, className, subject, stream);
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get Chapters");
  }
};

export const getAiNotes = async (
  req: NotesRequest,
  res: Response<ApiResponse<EnrichedNote[]>>
): Promise<void> => {
  try {
    const data = await AiNoteService.getAiNotes(req.query);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    handleError(res, error, "Get AI Notes");
  }
};

export const createAiNotes = async (
  req: CreateAiNotesRequest,
  res: Response<ApiResponse<CreateNoteResult[]>>
): Promise<void> => {
  try {
    const {
      language,
      board,
      class:              className,
      subject,
      stream,
      chapters,
      short_notes:        shortNotesRaw,
      noteChapterIndices: noteIndicesRaw,
      bookChapterIndices: bookIndicesRaw,
      created_by,
    } = req.body;

    const results = await AiNoteService.createAiNotes({
      language,
      board,
      className,
      subject,
      stream,
      chapterList:    JSON.parse(chapters)                                               as string[],
      shortNotesList: shortNotesRaw  ? JSON.parse(shortNotesRaw)  as (string | null)[]  : [],
      noteIndices:    noteIndicesRaw ? JSON.parse(noteIndicesRaw) as number[]            : [],
      bookIndices:    bookIndicesRaw ? JSON.parse(bookIndicesRaw) as number[]            : [],
      noteFiles:      req.files?.notes ?? [],
      bookFiles:      req.files?.books ?? [],
      created_by,
    });

    res.status(200).json({ success: true, message: "Notes uploaded successfully", results });

  } catch (error) {
    handleError(res, error, "Create Notes");
  } finally {
    cleanupTempFiles(req.files as AiNoteFiles | undefined);
  }
};
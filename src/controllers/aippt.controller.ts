import fs                   from "fs";
import { Request, Response } from "express";
import * as AiPptService     from "../services/aippt.service.ts";
import { ValidationError }   from "../services/aippt.service.ts";
import type {
  CreateAiPptPayload,
  CreatePptResult,
  EnrichedPpt,
} from "../services/aippt.service.ts";
import type { FindPptFilters } from "../repositories/aippt.repository.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PptFiles {
  ppts?: Express.Multer.File[];
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  count?: number;
  message?: string;
  results?: T;
}

interface CreateAiPptBody {
  language: string;
  board: string;
  stream: string;
  class: string;
  subject: string;
  chapter_ids: string;   // JSON array e.g. "[12, 45, 67]"
  topics: string;        // JSON array e.g. '["Algebra","Geometry"]'
  created_by?: string;
}

type GetPptsRequest   = Request<{}, {}, {}, FindPptFilters>;
type CreatePptRequest = Request<{}, {}, CreateAiPptBody, {}> & { files?: PptFiles };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanupTempFiles(files: PptFiles | undefined): void {
  if (!files) return;
  for (const file of files.ppts ?? []) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
        console.log(`🗑️  Deleted temp file: ${file.path}`);
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

/**
 * GET /ai-ppt/languages
 * Returns distinct languages from the ai_ppt table.
 * Same pattern as GET /ai-notes/languages.
 */
export const getLanguages = async (
  _req: Request,
  res:  Response<ApiResponse<string[]>>
): Promise<void> => {
  try {
    const data = await AiPptService.getLanguages();
    res.status(200).json({ success: true, data });
  } catch (error) {
    handleError(res, error, "Get PPT Languages");
  }
};

/**
 * GET /ai-ppt
 * Query params: language, board, stream, class, subject, chapter_id
 */
export const getAiPpts = async (
  req: GetPptsRequest,
  res: Response<ApiResponse<EnrichedPpt[]>>
): Promise<void> => {
  try {
    const data = await AiPptService.getAiPpts(req.query);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    handleError(res, error, "Get AI PPTs");
  }
};

/**
 * POST /ai-ppt
 * Multipart form — files field must be "ppts".
 */
export const createAiPpts = async (
  req: CreatePptRequest,
  res: Response<ApiResponse<CreatePptResult[]>>
): Promise<void> => {
  try {
    const {
      language,
      board,
      stream,
      class:       classId,
      subject,
      chapter_ids: chapterIdsRaw,
      topics:      topicsRaw,
      created_by,
    } = req.body;

    const chapter_ids: number[] = JSON.parse(chapterIdsRaw) as number[];
    const topics:      string[] = JSON.parse(topicsRaw)      as string[];
    const pptFiles              = req.files?.ppts ?? [];

    const results = await AiPptService.createAiPpts({
      language,
      board,
      stream:     Number(stream),
      class:      Number(classId),
      subject:    Number(subject),
      chapter_ids,
      topics,
      pptFiles,
      created_by,
    });

    res.status(200).json({
      success: true,
      message: "PPTs uploaded successfully",
      results,
    });

  } catch (error) {
    handleError(res, error, "Create AI PPTs");
  } finally {
    cleanupTempFiles(req.files as PptFiles | undefined);
  }
};
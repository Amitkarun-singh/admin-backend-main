import sequelize           from "../config/db.js";
import { uploadToS3 }      from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";
import {
  findDistinctLanguages,
  findPpts,
  createPpt,
} from "../repositories/aippt.repository.ts";
import type { FindPptFilters } from "../repositories/aippt.repository.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateAiPptPayload {
  language: string;
  board: string;
  stream: number;
  class: number;
  subject: number;
  /**
   * Parallel arrays — each entry corresponds to one PPT file.
   * chapter_ids[i]  → curriculum chapter id for pptFiles[i]
   * topics[i]       → chapter display name for pptFiles[i]
   */
  chapter_ids: number[];
  topics: string[];
  pptFiles: Express.Multer.File[];
  created_by?: string;
}

export interface CreatePptResult {
  index: number;
  topic: string;
  chapter_id: number;
  pptKey: string | null;
  id: number;
}

export interface EnrichedPpt {
  id: number;
  language: string;
  board: string;
  stream: number;
  class: number;
  subject: number;
  chapter_id: number;
  topic: string;
  ppt?: string | null;
  created_by?: string;
  pptUrl: string | null;
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

/**
 * Languages come from the ai_ppt table itself (same pattern as ai_notes).
 * Everything else (board, class, stream, subject, chapter) comes from
 * the curriculum microservice directly on the frontend.
 */
export async function getLanguages(): Promise<string[]> {
  return findDistinctLanguages();
}

export async function getAiPpts(filters: FindPptFilters): Promise<EnrichedPpt[]> {
  const ppts = await findPpts(filters);

  return Promise.all(
    ppts.map(async (ppt): Promise<EnrichedPpt> => {
      const pptUrl = await getSignedPdfUrl(ppt.ppt);
      return { ...ppt.toJSON(), pptUrl };
    })
  );
}

export async function createAiPpts(
  payload: CreateAiPptPayload
): Promise<CreatePptResult[]> {
  const {
    language,
    board,
    stream,
    class: classId,
    subject,
    chapter_ids,
    topics,
    pptFiles,
    created_by = "Teacher",
  } = payload;

  // ── Validation ────────────────────────────────────────────────────────────
  assert(
    language && board && stream && classId && subject,
    "language, board, stream, class and subject are required"
  );
  assert(pptFiles.length > 0, "at least one PPT file is required");
  assert(
    pptFiles.length === chapter_ids.length,
    `chapter_ids length (${chapter_ids.length}) must match ppt file count (${pptFiles.length})`
  );
  assert(
    pptFiles.length === topics.length,
    `topics length (${topics.length}) must match ppt file count (${pptFiles.length})`
  );

  for (const id of chapter_ids) {
    assert(id > 0, `invalid chapter_id: ${id}`);
  }

  // ── Transaction ───────────────────────────────────────────────────────────
  const transaction = await sequelize.transaction();
  const results: CreatePptResult[] = [];

  try {
    for (let i = 0; i < pptFiles.length; i++) {
      const pptFile   = pptFiles[i];
      const chapterId = chapter_ids[i];
      const topic     = topics[i].trim();

      const { key: pptKey } = await uploadToS3(
        pptFile,
        "PPT",
        language,
        board,
        String(classId),
        String(subject),
        topic
      );
      console.log(`✅ PPT uploaded for chapter_id [${chapterId}] "${topic}":`, pptKey);

      const ppt = await createPpt(
        {
          language,
          board,
          stream:     Number(stream),
          class:      Number(classId),
          subject:    Number(subject),
          chapter_id: Number(chapterId),
          topic,
          ppt:        pptKey,
          created_by,
        },
        transaction
      );

      results.push({ index: i, topic, chapter_id: chapterId, pptKey, id: ppt.id });
      await sleep(500);
    }

    await transaction.commit();
    return results;

  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}
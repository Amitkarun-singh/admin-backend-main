import { Transaction } from "sequelize";
import AiPpt from "../models/aippt.model.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AiPptCreationAttributes {
  language: string;
  board: string;
  stream: number;
  class: number;
  subject: number;
  chapter_id: number;
  topic: string;
  ppt?: string | null;
  created_by?: string;
}

export interface FindPptFilters {
  language?: string;
  board?: string;
  stream?: number | string;
  class?: number | string;
  subject?: number | string;
  chapter_id?: number | string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns distinct language strings stored in the ai_ppt table.
 * Used to populate the language dropdown from our own data,
 * the same way ai_notes does it.
 */
export async function findDistinctLanguages(): Promise<string[]> {
  const rows = await AiPpt.findAll({
    attributes: ["language"],
    group:      ["language"],
    order:      [["language", "ASC"]],
  });
  return rows.map((r) => r.language);
}

export async function findPpts(filters: FindPptFilters): Promise<AiPpt[]> {
  const where: Record<string, unknown> = {};

  if (filters.language)   where.language   = filters.language;
  if (filters.board)      where.board      = filters.board;
  if (filters.stream)     where.stream     = Number(filters.stream);
  if (filters.class)      where.class      = Number(filters.class);
  if (filters.subject)    where.subject    = Number(filters.subject);
  if (filters.chapter_id) where.chapter_id = Number(filters.chapter_id);

  return AiPpt.findAll({ where, order: [["created_at", "ASC"]] });
}

export async function createPpt(
  payload: AiPptCreationAttributes,
  transaction: Transaction
): Promise<AiPpt> {
  return AiPpt.create(payload, { transaction });
}
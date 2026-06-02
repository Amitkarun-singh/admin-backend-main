import { Sequelize, Op, Transaction } from "sequelize";
import AiNoteNew from "../models/ainote_new.model.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AiNoteNewCreationAttributes {
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
}

export interface FindNotesFilters {
  language?: string;
  board?: string;
  class?: string;
  subject?: string;
  topic?: string;
  stream?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const STREAM_CLASSES: readonly string[] = ["11", "12"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function requiresStream(className: string | number): boolean {
  return STREAM_CLASSES.includes(String(className));
}

export function buildStreamCondition(
  className: string,
  stream?: string | null
): { stream: string | null } {
  if (requiresStream(className)) {
    return { stream: stream ?? null };
  }
  return { stream: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// Repository
// ─────────────────────────────────────────────────────────────────────────────

export async function findDistinctLanguages(): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    attributes: ["language"],
    group:      ["language"],
  });
  return rows.map((r) => r.language);
}

export async function findDistinctBoards(language: string): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    where:      { language },
    attributes: ["board"],
    group:      ["board"],
    order:      [["board", "ASC"]],
  });
  return rows.map((r) => r.board);
}

export async function findDistinctClasses(
  language: string,
  board: string
): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    where:      { language, board },
    attributes: ["class"],
    group:      ["class"],
    order:      [[Sequelize.literal("CAST(class AS UNSIGNED)"), "ASC"]],
  });
  return rows.map((r) => r.class);
}

export async function findDistinctStreams(
  language: string,
  board: string
): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    where: {
      language,
      board,
      class:  { [Op.in]: STREAM_CLASSES },
      stream: { [Op.ne]: null },
    },
    attributes: ["stream"],
    group:      ["stream"],
    order:      [["stream", "ASC"]],
  });
  return rows.map((r) => r.stream as string);
}

export async function findDistinctSubjects(
  language: string,
  board: string,
  className: string,
  stream?: string | null
): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    where: {
      language,
      board,
      class: className,
      ...buildStreamCondition(className, stream),
    },
    attributes: ["subject"],
    group:      ["subject"],
    order:      [["subject", "ASC"]],
  });
  return rows.map((r) => r.subject);
}

export async function findDistinctChapters(
  language: string,
  board: string,
  className: string,
  subject: string,
  stream?: string | null
): Promise<string[]> {
  const rows = await AiNoteNew.findAll({
    where: {
      language,
      board,
      class: className,
      subject,
      ...buildStreamCondition(className, stream),
    },
    attributes: ["topic"],
    group:      ["topic"],
    order:      [["topic", "ASC"]],
  });
  return rows.map((r) => r.topic);
}

export async function findNotes(filters: FindNotesFilters): Promise<AiNoteNew[]> {
  const { language, board, class: className, subject, topic, stream } = filters;

  const where: Record<string, unknown> = {};
  if (language) where.language = language;
  if (board)    where.board    = board;
  if (subject)  where.subject  = subject;
  if (topic)    where.topic    = topic;

  if (className) {
    where.class = className;
    Object.assign(where, buildStreamCondition(className, stream));
  }

  return AiNoteNew.findAll({ where, order: [["created_at", "ASC"]] });
}

export async function createNote(
  payload: AiNoteNewCreationAttributes,
  transaction: Transaction
): Promise<AiNoteNew> {
  return AiNoteNew.create(payload, { transaction });
}
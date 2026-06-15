import { Op } from "sequelize";
import Assessment from "../models/assessment.model.js";
import AssessmentQuestion from "../models/assessment_question.model.js";
import AssessmentAssignment from "../models/assessment_assignment.model.js";
import { StudentAttempt, StudentAnswer } from "../models/student_attempt.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import StudentProfile from "../models/student_profile.model.js";
import User from "../models/user.model.js";

// ─── Inline types (derived from models) ──────────────────────────────────────

type Difficulty = "easy" | "medium" | "hard";
type AssessmentStatus = "draft" | "published" | "archived";
type GeneratedBy = "AI" | "TEACHER";
type QuestionType = "mcq" | "true_false" | "short" | "essay";
type QuestionStatus = "pending" | "approved" | "rejected";
type AttemptStatus = "in_progress" | "submitted";

interface OptionItem {
  key: string;
  text: string;
}

// ─── Assessment ───────────────────────────────────────────────────────────────

export const assessmentRepo = {
  findById: (assessment_id: bigint | string | number) =>
    Assessment.findByPk(assessment_id),

  findAll: (where: Record<string, unknown>, order: [string, string][] = [["created_at", "DESC"]]) =>
    Assessment.findAll({ where, order }),

  create: (data: {
    school_id: number;
    created_by: number;
    title: string;
    subject_id: number;
    class_id: number;
    topic?: string | null;
    difficulty: Difficulty;
    time_limit_minutes?: number | null;
    question_types_allowed: QuestionType[];
    status: AssessmentStatus;
    generated_by: GeneratedBy;
    start_datetime?: Date | null;
    end_datetime?: Date | null;
  }) => Assessment.create(data as any),

  updateStatus: (assessment_id: bigint | string | number, status: AssessmentStatus) =>
    Assessment.update({ status }, { where: { assessment_id } }),

  updateTotalMarks: (assessment_id: bigint | string | number, total_marks: number) =>
    Assessment.update({ total_marks }, { where: { assessment_id } }),

  incrementTotalMarks: (assessment_id: bigint | string | number, by: number) =>
    Assessment.increment("total_marks", { by, where: { assessment_id } }),

  destroy: (instance: Assessment) => instance.destroy(),
};

// ─── AssessmentQuestion ───────────────────────────────────────────────────────

export const questionRepo = {
  findById: (question_id: bigint | string | number) =>
    AssessmentQuestion.findByPk(question_id),

  findAll: (
    where: Record<string, unknown>,
    order: [string, string][] = [["order", "ASC"]]
  ) => AssessmentQuestion.findAll({ where, order }),

  findAllExcludeAnswer: (where: Record<string, unknown>) =>
    AssessmentQuestion.findAll({
      where,
      attributes: { exclude: ["correct_answer"] },
      order: [["order", "ASC"]],
    }),

  findLastByAssessment: (assessment_id: bigint | string | number) =>
    AssessmentQuestion.findOne({
      where: { assessment_id },
      order: [["order", "DESC"]],
    }),

  count: (where: Record<string, unknown>) =>
    AssessmentQuestion.count({ where }),

  bulkCreate: (
    rows: Array<{
      assessment_id: bigint;
      question_text: string;
      question_type: QuestionType;
      options: OptionItem[] | null;
      correct_answer: string | null;
      hint: string | null;
      marks: number;
      status: QuestionStatus;
      order: number;
    }>
  ) => AssessmentQuestion.bulkCreate(rows as any),

  create: (data: {
    assessment_id: bigint | string | number;
    question_text: string;
    question_type: QuestionType;
    options: OptionItem[] | null;
    correct_answer: string | null;
    hint: string | null;
    marks: number;
    status: QuestionStatus;
    order: number;
  }) => AssessmentQuestion.create(data as any),

  updateStatus: (question_id: bigint | string | number, status: QuestionStatus) =>
    AssessmentQuestion.update({ status }, { where: { question_id } }),

  bulkApprove: (assessment_id: bigint | string | number) =>
    AssessmentQuestion.update(
      { status: "approved" },
      { where: { assessment_id, status: "pending" } }
    ),

  destroy: (where: Record<string, unknown>) =>
    AssessmentQuestion.destroy({ where }),
};

// ─── AssessmentAssignment ─────────────────────────────────────────────────────

export const assignmentRepo = {
  findById: (assignment_id: bigint | string | number) =>
    AssessmentAssignment.findByPk(assignment_id),

  findAll: (where: Record<string, unknown>, order?: [string, string][]) =>
    AssessmentAssignment.findAll({ where, order }),

  count: (where: Record<string, unknown>) =>
    AssessmentAssignment.count({ where }),

  create: (data: {
    assessment_id: bigint | string | number;
    class_id: number;
    section_ids: number[];
    start_datetime: string;
    end_datetime: string;
    shuffle_questions: boolean;
    shuffle_options: boolean;
    show_result_immediately: boolean;
    assigned_by: bigint;
  }) => AssessmentAssignment.create(data as any),

  destroy: (where: Record<string, unknown>) =>
    AssessmentAssignment.destroy({ where }),
};

// ─── StudentAttempt ───────────────────────────────────────────────────────────

export const attemptRepo = {
  findById: (attempt_id: bigint | string | number) =>
    StudentAttempt.findByPk(attempt_id),

  findOne: (where: Record<string, unknown>) =>
    StudentAttempt.findOne({ where }),

  findAll: (where: Record<string, unknown>, order?: [string, string][]) =>
    StudentAttempt.findAll({ where, order }),

  count: (where: Record<string, unknown>) =>
    StudentAttempt.count({ where }),

  create: (data: {
    assignment_id: bigint | string | number;
    student_id: bigint | string | number;
    total_marks_possible?: number | null;
    status: AttemptStatus;
  }) => StudentAttempt.create(data as any),
};

// ─── StudentAnswer ────────────────────────────────────────────────────────────

export const answerRepo = {
  findAll: (where: Record<string, unknown>) =>
    StudentAnswer.findAll({ where }),

  bulkCreate: (
    rows: Array<{
      attempt_id: bigint | string | number;
      question_id: bigint | string | number;
      answer_text: string;
      is_correct: boolean | null;
      marks_obtained: number;
    }>
  ) => StudentAnswer.bulkCreate(rows as any),
};

// ─── Admin lookups (via Curriculum Microservice) ─────────────────────────────
// The assessment module stores class_id / section_id / subject_id that come
// from the curriculum service (NOT the legacy admin_* DB tables).
// All name-resolution is therefore done by fetching from the curriculum service
// and filtering by ID.  A short TTL cache avoids N+1 HTTP calls in bulk loops.

import curriculumService from "../services/curriculum.service.js";

export interface CurriculumClass   { id: number; class_name: string }
export interface CurriculumSection { id: number; section_name: string }
export interface CurriculumSubject { id: number; subject_name: string }

// ── Simple TTL cache (per process) ───────────────────────────────────────────
const CACHE_TTL_MS = 60_000;

let classCache:   { data: CurriculumClass[];   ts: number } | null = null;
let sectionCache: { data: CurriculumSection[]; ts: number } | null = null;

async function getAllClasses(): Promise<CurriculumClass[]> {
  if (classCache && Date.now() - classCache.ts < CACHE_TTL_MS) return classCache.data;
  const raw = await curriculumService.allClass();
  const list: CurriculumClass[] = (Array.isArray(raw) ? raw : (raw?.data ?? [])).map(
    (c: any) => ({ id: Number(c.id ?? c.class_id), class_name: c.class_name })
  );
  classCache = { data: list, ts: Date.now() };
  return list;
}

async function getAllSections(): Promise<CurriculumSection[]> {
  if (sectionCache && Date.now() - sectionCache.ts < CACHE_TTL_MS) return sectionCache.data;
  const raw = await curriculumService.section();
  const list: CurriculumSection[] = (Array.isArray(raw) ? raw : (raw?.data ?? [])).map(
    (s: any) => ({ id: Number(s.id ?? s.section_id), section_name: s.section_name })
  );
  sectionCache = { data: list, ts: Date.now() };
  return list;
}

// Subject lookup: curriculum service requires classId, so we accept it as an
// optional hint.  When classId is unknown we scan all classes (expensive but
// rare — only used during AI regeneration).
async function findSubjectByIdFromCurriculum(
  subject_id: number | string,
  board = "",
  streamId = 4,
  classId?: number | null
): Promise<CurriculumSubject | null> {
  const sid = Number(subject_id);

  // If we know the class, search there first
  if (classId != null) {
    try {
      const raw = await curriculumService.allSubject(classId, board, streamId);
      const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const found = list.find((s: any) => Number(s.id ?? s.subject_id) === sid);
      if (found) return { id: sid, subject_name: found.subject_name ?? found.name };
    } catch { /* fall through to class scan */ }
  }

  // Fallback: scan subjects across all classes (used in AI regeneration)
  const classes = await getAllClasses();
  for (const cls of classes) {
    try {
      const raw = await curriculumService.allSubject(cls.id, board, streamId);
      const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
      const found = list.find((s: any) => Number(s.id ?? s.subject_id) === sid);
      if (found) return { id: sid, subject_name: found.subject_name ?? found.name };
    } catch { /* continue scanning */ }
  }
  return null;
}

export const adminRepo = {
  findClassById: async (class_id: number | string) => {
    const list = await getAllClasses();
    return list.find(c => c.id === Number(class_id)) ?? null;
  },

  findSectionById: async (section_id: number | string) => {
    const list = await getAllSections();
    return list.find(s => s.id === Number(section_id)) ?? null;
  },

  findSectionsByIds: async (ids: number[]) => {
    if (!ids.length) return [];
    const set  = new Set(ids.map(Number));
    const list = await getAllSections();
    return list.filter(s => set.has(s.id));
  },

  findSubjectById: (subject_id: number | string, classId?: number | null) =>
    findSubjectByIdFromCurriculum(subject_id, "", 4, classId),

  findClassesByIds: async (ids: number[]) => {
    if (!ids.length) return [];
    const set  = new Set(ids.map(Number));
    const list = await getAllClasses();
    return list.filter(c => set.has(c.id));
  },

  findSectionsByIdsMany: async (ids: number[]) => {
    if (!ids.length) return [];
    const set  = new Set(ids.map(Number));
    const list = await getAllSections();
    return list.filter(s => set.has(s.id));
  },
};


// ─── Student lookups ──────────────────────────────────────────────────────────

export const studentRepo = {
  findProfileByUserId: (user_id: bigint | string | number) =>
    StudentProfile.findOne({ where: { user_id } }),

  findProfileByStudentId: (student_id: bigint | string | number) =>
    StudentProfile.findOne({ where: { student_id } }),

  findProfilesByStudentIds: (ids: (bigint | number)[]) =>
    StudentProfile.findAll({ where: { student_id: { [Op.in]: ids } } }),

  findClassSection: (where: Record<string, unknown>) =>
    StudentClassSection.findOne({ where }),

  findClassSectionsByStudentIds: (ids: (bigint | number)[]) =>
    StudentClassSection.findAll({ where: { student_id: { [Op.in]: ids } } }),

  findClassSectionsByClassAndSections: (class_id: number, section_ids: number[]) =>
    StudentClassSection.findAll({
      where: {
        class_id,
        section_id: { [Op.in]: section_ids.map(Number) },
      },
    }),

  findUsersByIds: (ids: (bigint | number)[]) =>
    User.findAll({ where: { user_id: { [Op.in]: ids } } }),
};
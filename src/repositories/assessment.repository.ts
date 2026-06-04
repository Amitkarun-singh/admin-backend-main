import { Op } from "sequelize";
import Assessment from "../models/assessment.model.js";
import AssessmentQuestion from "../models/assessment_question.model.js";
import AssessmentAssignment from "../models/assessment_assignment.model.js";
import { StudentAttempt, StudentAnswer } from "../models/student_attempt.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";
import AdminSubject from "../models/admin_subject_master.model.js";
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

// ─── Admin lookups ────────────────────────────────────────────────────────────

export const adminRepo = {
  findClassById: (class_id: number | string) =>
    AdminClass.findByPk(class_id),

  findSectionById: (section_id: number | string) =>
    AdminSection.findByPk(section_id),

  findSectionsByIds: (ids: number[]) =>
    AdminSection.findAll({ where: { section_id: { [Op.in]: ids } } }),

  findSubjectById: (subject_id: number | string) =>
    AdminSubject.findByPk(subject_id),

  findClassesByIds: (ids: number[]) =>
    AdminClass.findAll({ where: { class_id: { [Op.in]: ids } } }),

  findSectionsByIdsMany: (ids: number[]) =>
    AdminSection.findAll({ where: { section_id: { [Op.in]: ids } } }),
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
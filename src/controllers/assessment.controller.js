import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { Op } from "sequelize";

import Assessment           from "../models/assessment.model.js";
import AssessmentQuestion   from "../models/assessment_question.model.js";
import AssessmentAssignment from "../models/assessment_assignment.model.js";
import { StudentAttempt, StudentAnswer } from "../models/student_attempt.model.js";

import AdminClass          from "../models/admin_class.model.js";
import AdminSection        from "../models/admin_section.model.js";
import AdminSubject        from "../models/admin_subject_master.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import StudentProfile      from "../models/student_profile.model.js";
import User from "../models/user.model.js";

import { ApiError }    from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ─────────────────────────────────────────
   AI clients
───────────────────────────────────────── */
let openai;
try {
  openai = new OpenAI({
   
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch { console.warn("OPENROUTER_API_KEY missing"); }

let gemini;
try {
  gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
} catch { console.warn("GEMINI_API_KEY missing"); }


/* ─────────────────────────────────────────
   Helper: safely extract an array from any
   AI response shape.
───────────────────────────────────────── */
function extractArray(raw) {
  if (Array.isArray(raw)) return raw;

  if (typeof raw !== "string")
    throw new Error(`AI returned non-string, non-array: ${typeof raw}`);

  const clean = raw.replace(/```json|```/gi, "").trim();

  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val)) return val;
      }
    }
  } catch { /* fall through to regex */ }

  const match = clean.match(/\[[\s\S]*\]/);
  if (match) {
    const arr = JSON.parse(match[0]);
    if (Array.isArray(arr)) return arr;
  }

  throw new Error(`Could not extract array from AI response: ${clean.slice(0, 300)}`);
}


/* ─────────────────────────────────────────
   Helper: parse section_ids from DB (handles
   string JSON, array, null, BigInt, etc.)
───────────────────────────────────────── */
function parseSectionIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    try { return JSON.parse(raw).map(Number); } catch { return []; }
  }
  return [];
}


/* ─────────────────────────────────────────
   Helper: get all student user_ids for a
   given class_id + array of section_ids
───────────────────────────────────────── */
async function getStudentUserIdsForSections(classId, sectionIds) {
  const classSections = await StudentClassSection.findAll({
    where: {
      class_id:   classId,
      section_id: { [Op.in]: sectionIds.map(Number) },
    },
  });

  const studentIds = classSections.map(cs => cs.student_id);
  if (!studentIds.length) return [];

  const profiles = await StudentProfile.findAll({
    where: { student_id: { [Op.in]: studentIds } },
    attributes: ["user_id"],
  });

  return profiles.map(p => p.user_id);
}


/* ─────────────────────────────────────────
   Helper: enrich assessment with class &
   section names from admin tables.
───────────────────────────────────────── */
async function enrichWithClassSection(assessment) {
  const classRow = await AdminClass.findByPk(assessment.class_id);

  // An assessment is tied to a class; sections come from assignments
  return {
    ...assessment.toJSON(),
    class_name: classRow?.class_name ?? null,
  };
}


/* ─────────────────────────────────────────
   Internal: call AI and return question array
───────────────────────────────────────── */
async function generateQuestionsAI({ subject, topic, difficulty, count, types }) {
  const typeList = types.join(", ");

  const prompt = `
You are an exam question generator for school students.

Generate exactly ${count} questions on the topic below.
Return ONLY a valid JSON array — no markdown, no extra text, no wrapper object.

Each element:
{
  "question_text": "...",
  "question_type": "mcq",
  "options": [{"key":"A","text":"..."},{"key":"B","text":"..."},{"key":"C","text":"..."},{"key":"D","text":"..."}],
  "correct_answer": "A",
  "hint": "...",
  "marks": 1
}

Rules:
- question_type must be one of: ${typeList}
- mcq        → 4 options A-D, correct_answer = key letter
- true_false → options = [{"key":"T","text":"True"},{"key":"F","text":"False"}], correct_answer = "T" or "F"
- short/essay → options = null, correct_answer = brief model answer
- marks      → mcq/true_false = 1, short = 2, essay = 5
- difficulty → ${difficulty}
- subject    → ${subject}
- topic      → ${topic}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Output only a raw JSON array. No markdown, no wrapper object, no explanation." },
        { role: "user",   content: prompt },
      ],
    });
    const raw = res.choices[0].message.content;
    console.log("[AI] OpenRouter raw (first 300):", raw?.slice(0, 300));
    return extractArray(raw);
  } catch (err) {
    console.warn("[AI] OpenRouter failed:", err.message, "— trying Gemini");
  }

  const res = await gemini.models.generateContent({
    model:    "gemini-2.0-flash",
    contents: prompt,
  });
  const raw = res.text;
  console.log("[AI] Gemini raw (first 300):", raw?.slice(0, 300));
  return extractArray(raw);
}


/* ═══════════════════════════════════════════════════
   Helper: normalize options before DB storage.
   Ensures options is ALWAYS stored as a JS array [{key,text},...]
   so Sequelize DataTypes.JSON stringifies it exactly ONCE.
═══════════════════════════════════════════════════ */
function normalizeOptions(raw) {
  if (raw === null || raw === undefined) return null;

  // Already a proper array of objects with key+text → use as-is
  if (Array.isArray(raw) && raw.length > 0 && raw[0] && typeof raw[0] === "object" && raw[0].key !== undefined) {
    return raw;  // e.g. [{key:"A",text:"..."}, ...]
  }

  // JSON string → parse once
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      // If parsed is an array of {key,text} objects, return it
      if (Array.isArray(parsed) && parsed[0]?.key !== undefined) return parsed;
      // If parsed is still a string, try one more parse
      if (typeof parsed === "string") {
        const p2 = JSON.parse(parsed);
        if (Array.isArray(p2)) return p2;
      }
      return parsed;
    } catch { return null; }
  }

  return raw; // fallback: store as-is
}


/* ═══════════════════════════════════════════════════
   TEACHER: Create assessment + AI-generate questions
   POST /api/assessments
═══════════════════════════════════════════════════ */
export const createAssessment = asyncHandler(async (req, res) => {
  const { user_id, school_id } = req.user;

  const {
    title,
    subject_id,
    class_id,
    topic,
    difficulty         = "medium",
    time_limit_minutes,
    question_count     = 10,
    question_types     = ["mcq"],
    start_datetime,
    end_datetime,
  } = req.body;

  if (!title || !subject_id || !class_id)
    throw new ApiError(400, "title, subject_id and class_id are required");

  // ── Assessment period validation ───────────────────────────────────────
  if (start_datetime && end_datetime) {
    const start = new Date(start_datetime);
    const end   = new Date(end_datetime);
    const now   = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      throw new ApiError(400, "Invalid start_datetime or end_datetime format");

    if (start <= now)
      throw new ApiError(400, "start_datetime must be in the future");

    if (end <= start)
      throw new ApiError(400, "end_datetime must be after start_datetime");
  }
  // ───────────────────────────────────────────────────────────────────────

  const subjectRow = await AdminSubject.findByPk(subject_id);
  if (!subjectRow) throw new ApiError(404, "Subject not found");

  const classRow = await AdminClass.findByPk(class_id);
  if (!classRow) throw new ApiError(404, "Class not found");

  const assessment = await Assessment.create({
    school_id,
    created_by:             user_id,
    title,
    subject_id,
    class_id,
    topic,
    difficulty,
    time_limit_minutes:     time_limit_minutes ?? null,
    question_types_allowed: question_types,
    status:                 "draft",
    generated_by:           "AI",
    start_datetime:         start_datetime ?? null,
    end_datetime:           end_datetime   ?? null,
  });

  // ─────────────────────────────────────────────────────────────────────────

  let aiQuestions = [];
  try {
    aiQuestions = await generateQuestionsAI({
      subject:    subjectRow.subject_name,
      topic:      topic ?? title,
      difficulty,
      count:      question_count,
      types:      question_types,
    });
  } catch (err) {
    console.error("[createAssessment] AI failed:", err.message);
    return res.status(207).json(
      new ApiResponse(207, { assessment }, "Assessment created but AI generation failed. Add questions manually.")
    );
  }

  const questionsToInsert = aiQuestions.map((q, idx) => ({
    assessment_id:  assessment.assessment_id,
    question_text:  q.question_text,
    question_type:  q.question_type,
    options:        normalizeOptions(q.options),  // ← normalize before storage
    correct_answer: q.correct_answer ?? null,
    hint:           q.hint           ?? null,
    marks:          q.marks          ?? 1,
    status:         "pending",
    order:          idx + 1,
  }));

  await AssessmentQuestion.bulkCreate(questionsToInsert);

  const totalMarks = questionsToInsert.reduce((s, q) => s + q.marks, 0);
  await assessment.update({ total_marks: totalMarks });

  const questions = await AssessmentQuestion.findAll({
    where: { assessment_id: assessment.assessment_id },
    order: [["order", "ASC"]],
  });

  return res.status(201).json(
    new ApiResponse(201, {
      assessment: { ...assessment.toJSON(), class_name: classRow.class_name },
      questions,
    }, "Assessment created with AI questions")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Delete (archive) an assessment
   DELETE /api/assessments/:assessment_id
═══════════════════════════════════════════════════ */
export const deleteAssessment = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;
  const { user_id } = req.user;

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  if (Number(assessment.created_by) !== Number(user_id))
    throw new ApiError(403, "You can only delete your own assessments");

  // Check if any student has already started an attempt — hard-delete is unsafe then
  const assignments = await AssessmentAssignment.findAll({ where: { assessment_id } });
  const assignmentIds = assignments.map(a => a.assignment_id);

  if (assignmentIds.length) {
    const attemptCount = await StudentAttempt.count({
      where: { assignment_id: { [Op.in]: assignmentIds } },
    });

    if (attemptCount > 0) {
      // Soft-delete: archive so results are preserved
      await assessment.update({ status: "archived" });
      return res.status(200).json(
        new ApiResponse(200, { assessment_id, status: "archived" },
          "Assessment archived (students have attempts — data preserved)")
      );
    }
  }

  // No attempts: safe to hard-delete questions and assessment
  await AssessmentQuestion.destroy({ where: { assessment_id } });
  if (assignmentIds.length) {
    await AssessmentAssignment.destroy({ where: { assessment_id } });
  }
  await assessment.destroy();

  return res.status(200).json(
    new ApiResponse(200, { assessment_id }, "Assessment deleted successfully")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Get all assessments created by this teacher
   GET /api/assessments/teacher/my
═══════════════════════════════════════════════════ */
export const getTeacherAssessments = asyncHandler(async (req, res) => {
  const { user_id } = req.user;

  const { status, class_id, subject_id } = req.query;

  const where = { created_by: user_id };
  if (status)     where.status     = status;
  if (class_id)   where.class_id   = Number(class_id);
  if (subject_id) where.subject_id = Number(subject_id);

  const assessments = await Assessment.findAll({
    where,
    order: [["created_at", "DESC"]],
  });

  const data = await Promise.all(assessments.map(async (a) => {
    const [total, pending, approved, assignmentCount, classRow, subjectRow] = await Promise.all([
      AssessmentQuestion.count({ where: { assessment_id: a.assessment_id } }),
      AssessmentQuestion.count({ where: { assessment_id: a.assessment_id, status: "pending"  } }),
      AssessmentQuestion.count({ where: { assessment_id: a.assessment_id, status: "approved" } }),
      AssessmentAssignment.count({ where: { assessment_id: a.assessment_id } }),
      AdminClass.findByPk(a.class_id),
      AdminSubject.findByPk(a.subject_id)
    ]);

    return {
      ...a.toJSON(),
      class_name:       classRow?.class_name ?? null,
      subject_name:     subjectRow?.subject_name ?? null,
      question_summary: { total, pending, approved },
      assignment_count: assignmentCount,
    };
  }));

  return res.status(200).json(
    new ApiResponse(200, data, "Teacher assessments fetched")
  );
});


/* ═══════════════════════════════════════════════════
   ANY ROLE: Get all assessments for the logged-in user
   GET /api/assessments/user/all
═══════════════════════════════════════════════════ */
export const getAssessmentsByUser = asyncHandler(async (req, res) => {
  const { user_id, role } = req.user;
  const now = new Date();

  /* ── TEACHER / ADMIN / SUBADMIN ── */
  if (["TEACHER", "ADMIN", "SUBADMIN"].includes(role)) {
    const { status, class_id, subject_id } = req.query;
    const where = { created_by: user_id };
    if (status)     where.status     = status;
    if (class_id)   where.class_id   = Number(class_id);
    if (subject_id) where.subject_id = Number(subject_id);

    const assessments = await Assessment.findAll({
      where,
      order: [["created_at", "DESC"]],
    });

    const data = await Promise.all(assessments.map(async (a) => {
      const [total, pending, approved, assignmentCount, classRow] = await Promise.all([
        AssessmentQuestion.count({ where: { assessment_id: a.assessment_id } }),
        AssessmentQuestion.count({ where: { assessment_id: a.assessment_id, status: "pending"  } }),
        AssessmentQuestion.count({ where: { assessment_id: a.assessment_id, status: "approved" } }),
        AssessmentAssignment.count({ where: { assessment_id: a.assessment_id } }),
        AdminClass.findByPk(a.class_id),
      ]);

      return {
        ...a.toJSON(),
        class_name:       classRow?.class_name ?? null,
        question_summary: { total, pending, approved },
        assignment_count: assignmentCount,
      };
    }));

    return res.status(200).json(new ApiResponse(200, data, "Assessments fetched"));
  }

  /* ── STUDENT ── */
  if (role === "STUDENT") {
    const studentProfile = await StudentProfile.findOne({ where: { user_id } });
    if (!studentProfile) throw new ApiError(404, "Student profile not found");

    const classSection = await StudentClassSection.findOne({
      where: { student_id: studentProfile.student_id },
    });
    if (!classSection) throw new ApiError(404, "Class not assigned to this student");

    const [classRow, sectionRow] = await Promise.all([
      AdminClass.findByPk(classSection.class_id),
      AdminSection.findByPk(classSection.section_id),
    ]);

    const assignments = await AssessmentAssignment.findAll({
      where: { class_id: classSection.class_id },
      order: [["created_at", "DESC"]],
    });

    const studentSectionId = Number(classSection.section_id);

    const relevant = assignments.filter(a =>
      parseSectionIds(a.section_ids).includes(studentSectionId)
    );

    const data = await Promise.all(relevant.map(async (asgn) => {
      const assessment = await Assessment.findByPk(asgn.assessment_id);
      const attempt    = await StudentAttempt.findOne({
        where: { assignment_id: asgn.assignment_id, student_id: studentProfile.student_id },
      });

      let window_status = "upcoming";
      if (now >= new Date(asgn.start_datetime) && now <= new Date(asgn.end_datetime)) {
        window_status = "active";
      } else if (now > new Date(asgn.end_datetime)) {
        window_status = "expired";
      }

      // Include result summary if attempt is submitted
      let result_summary = null;
      if (attempt?.status === "submitted") {
        result_summary = {
          total_marks_obtained: attempt.total_marks_obtained,
          total_marks_possible: attempt.total_marks_possible,
          percentage: attempt.total_marks_possible
            ? Math.round((attempt.total_marks_obtained / attempt.total_marks_possible) * 100)
            : 0,
        };
      }

      return {
        assignment_id:      asgn.assignment_id,
        assessment_id:      assessment.assessment_id,
        title:              assessment.title,
        subject_id:         assessment.subject_id,
        class_id:           assessment.class_id,
        class_name:         classRow?.class_name   ?? null,
        section_name:       sectionRow?.section_name ?? null,
        difficulty:         assessment.difficulty,
        time_limit_minutes: assessment.time_limit_minutes,
        total_marks:        assessment.total_marks,
        start_datetime:     asgn.start_datetime,
        end_datetime:       asgn.end_datetime,
        window_status,
        attempted:          !!attempt,
        attempt_status:     attempt?.status ?? null,
        attempt_id:         attempt?.attempt_id ?? null,
        result_summary,
      };
    }));

    return res.status(200).json(new ApiResponse(200, data, "Assessments fetched"));
  }

  throw new ApiError(403, "Role not supported for this endpoint");
});


/* ═══════════════════════════════════════════════════
   TEACHER: Get one assessment with all questions
   GET /api/assessments/:assessment_id
═══════════════════════════════════════════════════ */
export const getAssessment = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  const [questions, classRow] = await Promise.all([
    AssessmentQuestion.findAll({
      where: { assessment_id },
      order: [["order", "ASC"]],
    }),
    AdminClass.findByPk(assessment.class_id),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      assessment: { ...assessment.toJSON(), class_name: classRow?.class_name ?? null },
      questions,
    }, "Assessment fetched")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Review a single question
   PATCH /api/assessments/questions/:question_id
   action: approve | edit | delete | regenerate
═══════════════════════════════════════════════════ */
export const reviewQuestion = asyncHandler(async (req, res) => {
  const { question_id } = req.params;
  const { action, question_text, options, correct_answer, hint, marks } = req.body;

  const question = await AssessmentQuestion.findByPk(question_id);
  if (!question) throw new ApiError(404, "Question not found");

  if (action === "approve") {
    await question.update({ status: "approved" });
    return res.status(200).json(new ApiResponse(200, { question }, "Question approved"));
  }

  if (action === "delete") {
    const aid = question.assessment_id;
    await question.destroy();
    const remaining = await AssessmentQuestion.findAll({ where: { assessment_id: aid } });
    const total = remaining.reduce((s, q) => s + q.marks, 0);
    await Assessment.update({ total_marks: total }, { where: { assessment_id: aid } });
    return res.status(200).json(new ApiResponse(200, {}, "Question deleted"));
  }

  if (action === "edit") {
    const updates = { status: "approved" };
    if (question_text  !== undefined) updates.question_text  = question_text;
    if (options        !== undefined) updates.options        = options;
    if (correct_answer !== undefined) updates.correct_answer = correct_answer;
    if (hint           !== undefined) updates.hint           = hint;
    if (marks          !== undefined) updates.marks          = marks;
    await question.update(updates);

    if (marks !== undefined) {
      const all   = await AssessmentQuestion.findAll({ where: { assessment_id: question.assessment_id } });
      const total = all.reduce((s, q) => s + q.marks, 0);
      await Assessment.update({ total_marks: total }, { where: { assessment_id: question.assessment_id } });
    }
    return res.status(200).json(new ApiResponse(200, { question }, "Question updated"));
  }

  if (action === "regenerate") {
    const assessment = await Assessment.findByPk(question.assessment_id);
    const subjectRow = await AdminSubject.findByPk(assessment.subject_id);

    const [newQ] = await generateQuestionsAI({
      subject:    subjectRow.subject_name,
      topic:      assessment.topic ?? assessment.title,
      difficulty: assessment.difficulty,
      count:      1,
      types:      [question.question_type],
    });

    await question.update({
      question_text:  newQ.question_text,
      options:        newQ.options        ?? null,
      correct_answer: newQ.correct_answer ?? null,
      hint:           newQ.hint           ?? null,
      marks:          newQ.marks          ?? question.marks,
      status:         "pending",
    });

    return res.status(200).json(new ApiResponse(200, { question }, "Question regenerated"));
  }

  throw new ApiError(400, "Invalid action. Use: approve | edit | delete | regenerate");
});


/* ═══════════════════════════════════════════════════
   TEACHER: Approve ALL pending questions at once
   PATCH /api/assessments/:assessment_id/questions/approve-all
═══════════════════════════════════════════════════ */
export const approveAllQuestions = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  const [updatedCount] = await AssessmentQuestion.update(
    { status: "approved" },
    { where: { assessment_id, status: "pending" } }
  );

  if (updatedCount === 0) {
    return res.status(200).json(
      new ApiResponse(200, { approved: 0 }, "No pending questions — all already approved")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { approved: updatedCount }, `${updatedCount} question(s) approved`)
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Add a new question manually (auto-approved)
   POST /api/assessments/:assessment_id/questions
═══════════════════════════════════════════════════ */
export const addQuestion = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;
  const {
    question_text,
    question_type,
    options        = null,
    correct_answer = null,
    hint           = null,
    marks          = 1,
  } = req.body;

  if (!question_text || !question_type)
    throw new ApiError(400, "question_text and question_type are required");

  const validTypes = ["mcq", "true_false", "short", "essay"];
  if (!validTypes.includes(question_type))
    throw new ApiError(400, `question_type must be one of: ${validTypes.join(", ")}`);

  if (["mcq", "true_false"].includes(question_type) && !correct_answer)
    throw new ApiError(400, "correct_answer is required for mcq and true_false");

  if (question_type === "mcq" && (!options || options.length < 2))
    throw new ApiError(400, "mcq requires at least 2 options [{key, text}]");

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  const lastQuestion = await AssessmentQuestion.findOne({
    where: { assessment_id },
    order: [["order", "DESC"]],
  });
  const nextOrder = lastQuestion ? lastQuestion.order + 1 : 1;

  const question = await AssessmentQuestion.create({
    assessment_id,
    question_text,
    question_type,
    options,
    correct_answer,
    hint,
    marks,
    status: "approved",
    order:  nextOrder,
  });

  await Assessment.increment("total_marks", { by: marks, where: { assessment_id } });

  return res.status(201).json(
    new ApiResponse(201, { question }, "Question added and approved")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Publish assessment
   PATCH /api/assessments/:assessment_id/publish
═══════════════════════════════════════════════════ */
export const publishAssessment = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  const [pendingCount, totalCount] = await Promise.all([
    AssessmentQuestion.count({ where: { assessment_id, status: "pending" } }),
    AssessmentQuestion.count({ where: { assessment_id } }),
  ]);

  if (totalCount === 0)
    throw new ApiError(400, "Cannot publish — assessment has no questions");
  if (pendingCount > 0)
    throw new ApiError(400, `${pendingCount} question(s) still pending. Approve or delete them first.`);

  await assessment.update({ status: "published" });

  return res.status(200).json(
    new ApiResponse(200, { assessment }, "Assessment published")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: Assign to class/sections
   POST /api/assessments/:assessment_id/assign
═══════════════════════════════════════════════════ */
export const assignAssessment = asyncHandler(async (req, res) => {
  const { user_id } = req.user;
  const { assessment_id } = req.params;
  const {
    class_id,
    section_ids,
    start_datetime,
    end_datetime,
    shuffle_questions       = false,
    shuffle_options         = false,
    show_result_immediately = false,
  } = req.body;

  if (!class_id || !section_ids?.length || !start_datetime || !end_datetime)
    throw new ApiError(400, "class_id, section_ids, start_datetime and end_datetime are required");

  // ── Assignment period validation ───────────────────────────────────────
  const start = new Date(start_datetime);
  const end   = new Date(end_datetime);
  const now   = new Date();

  if (isNaN(start.getTime()) || isNaN(end.getTime()))
    throw new ApiError(400, "Invalid start_datetime or end_datetime format");

  if (start <= now)
    throw new ApiError(400, "start_datetime must be in the future");

  if (end <= start)
    throw new ApiError(400, "end_datetime must be after start_datetime");
  // ───────────────────────────────────────────────────────────────────────

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");
  if (assessment.status !== "published")
    throw new ApiError(400, "Publish the assessment before assigning");

  const normalizedSectionIds = section_ids.map(Number);

  // Fetch class + section names for the response
  const [classRow, sectionRows] = await Promise.all([
    AdminClass.findByPk(class_id),
    AdminSection.findAll({ where: { section_id: { [Op.in]: normalizedSectionIds } } }),
  ]);

  const assignment = await AssessmentAssignment.create({
    assessment_id,
    class_id,
    section_ids:            normalizedSectionIds,
    start_datetime,
    end_datetime,
    shuffle_questions,
    shuffle_options,
    show_result_immediately,
    assigned_by:            user_id,
  });

  // ───────────────────────────────────────────────────────────────────────

  return res.status(201).json(
    new ApiResponse(201, {
      assignment,
      class_name:    classRow?.class_name ?? null,
      section_names: sectionRows.map(s => ({ section_id: s.section_id, section_name: s.section_name })),
    }, "Assessment assigned")
  );
});


/* ═══════════════════════════════════════════════════
   STUDENT: Get assigned tests (within time window)
   GET /api/assessments/student/assigned
═══════════════════════════════════════════════════ */
export const getStudentAssignedTests = asyncHandler(async (req, res) => {
  const { user_id } = req.user;
  const now = new Date();

  const studentProfile = await StudentProfile.findOne({ where: { user_id } });
  if (!studentProfile) throw new ApiError(404, "Student profile not found");

  const classSection = await StudentClassSection.findOne({
    where: { student_id: studentProfile.student_id },
  });
  if (!classSection) throw new ApiError(404, "Class not assigned to this student");

  const [classRow, sectionRow] = await Promise.all([
    AdminClass.findByPk(classSection.class_id),
    AdminSection.findByPk(classSection.section_id),
  ]);

  console.log("[getStudentAssignedTests] student:", studentProfile.student_id,
    "class_id:", classSection.class_id,
    "section_id:", classSection.section_id);

  // Fetch active + expired (not just active window) so student can see results too
  const assignments = await AssessmentAssignment.findAll({
    where: { class_id: classSection.class_id },
    order: [["start_datetime", "DESC"]],
  });

  console.log("[getStudentAssignedTests] raw assignments found:", assignments.length);

  const studentSectionId = Number(classSection.section_id);

  const relevant = assignments.filter(a => {
    const ids = parseSectionIds(a.section_ids);
    console.log("[getStudentAssignedTests] assignment", a.assignment_id,
      "section_ids:", ids, "| student section:", studentSectionId,
      "| match:", ids.includes(studentSectionId));
    return ids.includes(studentSectionId);
  });

  const data = await Promise.all(relevant.map(async (asgn) => {
    const assessment = await Assessment.findByPk(asgn.assessment_id);
    const attempt    = await StudentAttempt.findOne({
      where: { assignment_id: asgn.assignment_id, student_id: studentProfile.student_id },
    });

    // ── Window status ──────────────────────────────────────────────────
    let window_status = "upcoming";
    if (now >= new Date(asgn.start_datetime) && now <= new Date(asgn.end_datetime)) {
      window_status = "active";
    } else if (now > new Date(asgn.end_datetime)) {
      window_status = "expired";
    }
    // ───────────────────────────────────────────────────────────────────

    // ── Result summary (show when expired or show_result_immediately) ──
    let result_summary = null;
    if (attempt?.status === "submitted" &&
        (window_status === "expired" || asgn.show_result_immediately)) {
      result_summary = {
        total_marks_obtained: attempt.total_marks_obtained,
        total_marks_possible: attempt.total_marks_possible,
        percentage: attempt.total_marks_possible
          ? Math.round((attempt.total_marks_obtained / attempt.total_marks_possible) * 100)
          : 0,
        submitted_at: attempt.submitted_at,
      };
    }
    // ───────────────────────────────────────────────────────────────────

    return {
      assignment_id:      asgn.assignment_id,
      assessment_id:      assessment.assessment_id,
      title:              assessment.title,
      class_id:           classSection.class_id,
      class_name:         classRow?.class_name    ?? null,
      section_name:       sectionRow?.section_name ?? null,
      time_limit_minutes: assessment.time_limit_minutes,
      total_marks:        assessment.total_marks,
      start_datetime:     asgn.start_datetime,
      end_datetime:       asgn.end_datetime,
      window_status,
      attempted:          !!attempt,
      attempt_status:     attempt?.status  ?? null,
      attempt_id:         attempt?.attempt_id ?? null,
      result_summary,
    };
  }));

  return res.status(200).json(new ApiResponse(200, data, "Assigned tests fetched"));
});


/* ═══════════════════════════════════════════════════
   STUDENT: Start / resume attempt
   POST /api/assessments/attempt/start
═══════════════════════════════════════════════════ */
export const startAttempt = asyncHandler(async (req, res) => {
  const { user_id } = req.user;
  const { assignment_id } = req.body;

  const studentProfile = await StudentProfile.findOne({ where: { user_id } });
  if (!studentProfile) throw new ApiError(404, "Student profile not found");

  const assignment = await AssessmentAssignment.findByPk(assignment_id);
  if (!assignment) throw new ApiError(404, "Assignment not found");

  const now = new Date();
  if (now < new Date(assignment.start_datetime)) throw new ApiError(403, "Test has not started yet");
  if (now > new Date(assignment.end_datetime))   throw new ApiError(403, "Test deadline has passed");

  let attempt = await StudentAttempt.findOne({
    where: { assignment_id, student_id: studentProfile.student_id, status: "in_progress" },
  });

  if (!attempt) {
    const submitted = await StudentAttempt.findOne({
      where: { assignment_id, student_id: studentProfile.student_id, status: "submitted" },
    });
    if (submitted) throw new ApiError(409, "You have already submitted this test");

    const assessment = await Assessment.findByPk(assignment.assessment_id);
    attempt = await StudentAttempt.create({
      assignment_id,
      student_id:           studentProfile.student_id,
      total_marks_possible: assessment.total_marks,
      status:               "in_progress",
    });
  }

  let questions = await AssessmentQuestion.findAll({
    where:      { assessment_id: assignment.assessment_id, status: "approved" },
    attributes: { exclude: ["correct_answer"] },   // hint stays — students need it
    order:      [["order", "ASC"]],
  });

  if (assignment.shuffle_questions)
    questions = questions.sort(() => Math.random() - 0.5);

  // Normalize every question to a plain object with options as a proper [{key,text}] array.
  // IMPORTANT: DataTypes.JSON on a LONGTEXT column may return the stored JSON as a raw
  // string — we must parse it here. If shuffle_options was previously spreading that
  // string with [...str], each character became an element (the corruption bug).
  const normalizedQuestions = questions.map(q => {
    const json = q.toJSON ? q.toJSON() : q;

    // Normalize options → always [{key,text},...] or null
    let opts = json.options;
    if (typeof opts === "string") {
      try { opts = JSON.parse(opts); } catch { opts = null; }
      // Double-encoded: if still a string after one parse, parse again
      if (typeof opts === "string") {
        try { opts = JSON.parse(opts); } catch { opts = null; }
      }
    }
    // If it came back as a character array (legacy corrupt data), attempt recovery
    if (Array.isArray(opts) && opts.length > 8 && typeof opts[0] === "string" && opts[0].length <= 2) {
      try {
        const recovered = JSON.parse(opts.join(""));
        if (Array.isArray(recovered) && recovered[0]?.key) opts = recovered;
        else if (typeof recovered === "string") {
          const r2 = JSON.parse(recovered);
          if (Array.isArray(r2)) opts = r2;
        }
      } catch { opts = null; }
    }
    json.options = opts ?? null;

    // Shuffle options AFTER properly parsing them (not the raw string)
    if (assignment.shuffle_options && Array.isArray(json.options)) {
      json.options = [...json.options].sort(() => Math.random() - 0.5);
    }

    return json;
  });

  return res.status(200).json(
    new ApiResponse(200, { attempt, questions: normalizedQuestions }, "Attempt started")
  );
});


/* ═══════════════════════════════════════════════════
   STUDENT: Submit attempt
   POST /api/assessments/attempt/submit
═══════════════════════════════════════════════════ */
export const submitAttempt = asyncHandler(async (req, res) => {
  const { user_id } = req.user;
  const { attempt_id, answers = [], is_auto_submit = false } = req.body;

  const studentProfile = await StudentProfile.findOne({ where: { user_id } });
  const attempt        = await StudentAttempt.findByPk(attempt_id);

  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (Number(attempt.student_id) !== Number(studentProfile.student_id)) throw new ApiError(403, "Not your attempt");
  if (attempt.status === "submitted") throw new ApiError(409, "Already submitted");

  const questions = await AssessmentQuestion.findAll({
    where: { question_id: answers.map(a => a.question_id) },
  });
  const qMap = Object.fromEntries(questions.map(q => [q.question_id, q]));

  let totalObtained = 0;
  const answerRows = answers.map(a => {
    const q = qMap[a.question_id];
    if (!q) return null;

    let is_correct = null, marks_obtained = 0;

    if (["mcq", "true_false"].includes(q.question_type)) {
      is_correct     = a.answer_text?.trim().toUpperCase() === q.correct_answer?.trim().toUpperCase();
      marks_obtained = is_correct ? q.marks : 0;
    } else if (q.question_type === "short") {
      is_correct     = a.answer_text?.trim().toLowerCase() === q.correct_answer?.trim().toLowerCase();
      marks_obtained = is_correct ? q.marks : 0;
    }

    totalObtained += marks_obtained;
    return { attempt_id, question_id: a.question_id, answer_text: a.answer_text, is_correct, marks_obtained };
  }).filter(Boolean);

  await StudentAnswer.bulkCreate(answerRows);
  await attempt.update({
    submitted_at:         new Date(),
    is_auto_submitted:    is_auto_submit,
    total_marks_obtained: totalObtained,
    status:               "submitted",
  });

  const assignment = await AssessmentAssignment.findByPk(attempt.assignment_id);
  const response   = {
    attempt_id,
    submitted_at:         attempt.submitted_at,
    total_marks_obtained: totalObtained,
    total_marks_possible: attempt.total_marks_possible,
    percentage: attempt.total_marks_possible
      ? Math.round((totalObtained / attempt.total_marks_possible) * 100)
      : 0,
  };
  if (assignment.show_result_immediately) response.answers = answerRows;

  return res.status(200).json(new ApiResponse(200, response, "Attempt submitted successfully"));
});


/* ═══════════════════════════════════════════════════
   STUDENT / TEACHER: Result for one attempt
   GET /api/assessments/attempt/:attempt_id/result
═══════════════════════════════════════════════════ */
export const getAttemptResult = asyncHandler(async (req, res) => {
  const { attempt_id } = req.params;
  const { user_id, role } = req.user;

  const attempt = await StudentAttempt.findByPk(attempt_id);
  if (!attempt) throw new ApiError(404, "Attempt not found");

  if (role === "STUDENT") {
    const studentProfile = await StudentProfile.findOne({ where: { user_id } });
    if (attempt.student_id !== studentProfile.student_id) throw new ApiError(403, "Access denied");

    const assignment = await AssessmentAssignment.findByPk(attempt.assignment_id);
    if (!assignment.show_result_immediately && new Date() < new Date(assignment.end_datetime))
      throw new ApiError(403, "Results are not available until the test deadline");
  }

  // Fetch student profile and their class/section for context
  const studentProfile = await StudentProfile.findOne({ where: { student_id: attempt.student_id } });
  const classSection = studentProfile
    ? await StudentClassSection.findOne({ where: { student_id: attempt.student_id } })
    : null;

  const [classRow, sectionRow] = await Promise.all([
    classSection ? AdminClass.findByPk(classSection.class_id) : null,
    classSection ? AdminSection.findByPk(classSection.section_id) : null,
  ]);

  const answers = await StudentAnswer.findAll({ where: { attempt_id } });

  // Enrich each answer with question details so the frontend can render full review
  const qIds = answers.map(a => a.question_id).filter(Boolean);
  const questions = qIds.length
    ? await AssessmentQuestion.findAll({ where: { question_id: qIds } })
    : [];
  const qMap = Object.fromEntries(questions.map(q => [q.question_id, q]));

  const enrichedAnswers = answers.map(a => {
    const q = qMap[a.question_id];
    let opts = q?.options ?? null;
    // Normalize options (same logic as startAttempt)
    if (typeof opts === "string") {
      try { opts = JSON.parse(opts); } catch { opts = null; }
      if (typeof opts === "string") { try { opts = JSON.parse(opts); } catch { opts = null; } }
    }
    if (Array.isArray(opts) && opts.length > 8 && typeof opts[0] === "string" && opts[0].length <= 2) {
      try {
        const rec = JSON.parse(opts.join(""));
        if (Array.isArray(rec) && rec[0]?.key) opts = rec;
      } catch { opts = null; }
    }
    return {
      ...a.toJSON(),
      question_text:  q?.question_text  ?? "",
      question_type:  q?.question_type  ?? "mcq",
      correct_answer: q?.correct_answer ?? "",
      options:        opts,
    };
  });

  return res.status(200).json(
    new ApiResponse(200, {
      attempt: {
        ...attempt.toJSON(),
        percentage: attempt.total_marks_possible
          ? Math.round((attempt.total_marks_obtained / attempt.total_marks_possible) * 100)
          : 0,
      },
      student_info: {
        student_id:   attempt.student_id,
        class_name:   classRow?.class_name    ?? null,
        section_name: sectionRow?.section_name ?? null,
      },
      answers: enrichedAnswers,
    }, "Result fetched")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER / ADMIN: All results for an assignment
   GET /api/assessments/assignment/:assignment_id/results
═══════════════════════════════════════════════════ */
export const getAssignmentResults = asyncHandler(async (req, res) => {
  const { assignment_id } = req.params;

  const assignment = await AssessmentAssignment.findByPk(assignment_id);
  if (!assignment) throw new ApiError(404, "Assignment not found");

  const [attempts, classRow, assessment, sectionRows] = await Promise.all([
    StudentAttempt.findAll({
      where: { assignment_id, status: "submitted" },
      order: [["submitted_at", "ASC"]],
    }),
    AdminClass.findByPk(assignment.class_id),
    Assessment.findByPk(assignment.assessment_id),
    AdminSection.findAll({
      where: { section_id: { [Op.in]: parseSectionIds(assignment.section_ids) } },
    }),
  ]);

  const scores = attempts.map(a => Number(a.total_marks_obtained ?? 0));
  const avg    = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0;

  // Enrich each attempt with student class/section info
  const enrichedAttempts = await Promise.all(attempts.map(async (a) => {
    const classSection = await StudentClassSection.findOne({
      where: { student_id: a.student_id },
    });
    const [attemptClassRow, attemptSectionRow] = await Promise.all([
      classSection ? AdminClass.findByPk(classSection.class_id) : null,
      classSection ? AdminSection.findByPk(classSection.section_id) : null,
    ]);

    return {
      ...a.toJSON(),
      percentage: assessment.total_marks
        ? Math.round((Number(a.total_marks_obtained ?? 0) / assessment.total_marks) * 100)
        : 0,
      class_name:   attemptClassRow?.class_name    ?? null,
      section_name: attemptSectionRow?.section_name ?? null,
    };
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      assessment_title: assessment.title,
      class_name:       classRow?.class_name ?? null,
      sections:         sectionRows.map(s => ({ section_id: s.section_id, section_name: s.section_name })),
      total_marks:      assessment.total_marks,
      total_students:   attempts.length,
      avg_score:        Math.round(avg * 100) / 100,
      max_score:        scores.length ? Math.max(...scores) : 0,
      min_score:        scores.length ? Math.min(...scores) : 0,
      attempts:         enrichedAttempts,
    }, "Assignment results fetched")
  );
});


/* ═══════════════════════════════════════════════════
   STUDENT: Get questions for an existing attempt
   GET /api/assessments/attempt/:attempt_id/questions
   Used by the frontend after startAttempt to optionally
   re-fetch questions (e.g. for hints after a page refresh).
═══════════════════════════════════════════════════ */
export const getAttemptQuestions = asyncHandler(async (req, res) => {
  const { attempt_id } = req.params;
  const { user_id }    = req.user;

  const studentProfile = await StudentProfile.findOne({ where: { user_id } });
  if (!studentProfile) throw new ApiError(404, "Student profile not found");

  const attempt = await StudentAttempt.findByPk(attempt_id);
  if (!attempt) throw new ApiError(404, "Attempt not found");
  if (Number(attempt.student_id) !== Number(studentProfile.student_id))
    throw new ApiError(403, "Access denied");

  const assignment = await AssessmentAssignment.findByPk(attempt.assignment_id);
  if (!assignment) throw new ApiError(404, "Assignment not found");

  // Check the window is still open (or attempt is in_progress)
  const now = new Date();
  if (attempt.status !== "in_progress")
    throw new ApiError(403, "Attempt is not in progress");
  if (now > new Date(assignment.end_datetime))
    throw new ApiError(403, "Test deadline has passed");

  let questions = await AssessmentQuestion.findAll({
    where:      { assessment_id: assignment.assessment_id, status: "approved" },
    attributes: { exclude: ["correct_answer"] },  // hint included, correct_answer excluded
    order:      [["order", "ASC"]],
  });

  if (assignment.shuffle_questions)
    questions = questions.sort(() => Math.random() - 0.5);

  // Same normalization as startAttempt — parse options string, recover character arrays
  const normalizedQuestions = questions.map(q => {
    const json = q.toJSON ? q.toJSON() : q;
    let opts = json.options;
    if (typeof opts === "string") {
      try { opts = JSON.parse(opts); } catch { opts = null; }
      if (typeof opts === "string") { try { opts = JSON.parse(opts); } catch { opts = null; } }
    }
    if (Array.isArray(opts) && opts.length > 8 && typeof opts[0] === "string" && opts[0].length <= 2) {
      try {
        const recovered = JSON.parse(opts.join(""));
        if (Array.isArray(recovered) && recovered[0]?.key) opts = recovered;
        else if (typeof recovered === "string") { const r2 = JSON.parse(recovered); if (Array.isArray(r2)) opts = r2; }
      } catch { opts = null; }
    }
    json.options = opts ?? null;
    if (assignment.shuffle_options && Array.isArray(json.options)) {
      json.options = [...json.options].sort(() => Math.random() - 0.5);
    }
    return json;
  });

  return res.status(200).json(
    new ApiResponse(200, { attempt_id: attempt.attempt_id, questions: normalizedQuestions }, "Questions fetched")
  );
});


/* ═══════════════════════════════════════════════════
   TEACHER: All student results for one assessment
   GET /api/assessments/:assessment_id/all-results
═══════════════════════════════════════════════════ */
export const getAssessmentResults = asyncHandler(async (req, res) => {
  const { assessment_id } = req.params;

  const assessment = await Assessment.findByPk(assessment_id);
  if (!assessment) throw new ApiError(404, "Assessment not found");

  const assignments = await AssessmentAssignment.findAll({ where: { assessment_id } });
  if (!assignments.length) {
    return res.status(200).json(
      new ApiResponse(200, {
        assessment_title: assessment.title,
        total_marks:      assessment.total_marks,
        total_students:   0,
        avg_score:        0,
        max_score:        0,
        min_score:        0,
        attempts:         [],
      }, "No assignments found")
    );
  }

  const assignmentIds = assignments.map(a => a.assignment_id);
  const attempts = await StudentAttempt.findAll({
    where: { assignment_id: { [Op.in]: assignmentIds }, status: "submitted" },
    order: [["submitted_at", "ASC"]],
  });

  if (!attempts.length) {
    return res.status(200).json(
      new ApiResponse(200, {
        assessment_title: assessment.title,
        total_marks:      assessment.total_marks,
        total_students:   0,
        avg_score:        0,
        max_score:        0,
        min_score:        0,
        attempts:         [],
      }, "No submissions yet")
    );
  }

  // Batch-fetch all related data
  const studentIds = [...new Set(attempts.map(a => a.student_id))];

  const [profiles, classSections] = await Promise.all([
    StudentProfile.findAll({ where: { student_id: { [Op.in]: studentIds } } }),
    StudentClassSection.findAll({ where: { student_id: { [Op.in]: studentIds } } }),
  ]);

  const profileByStudentId      = Object.fromEntries(profiles.map(p => [Number(p.student_id), p]));
  const classSectionByStudentId = Object.fromEntries(classSections.map(cs => [Number(cs.student_id), cs]));

  const userIds    = [...new Set(profiles.map(p => p.user_id).filter(Boolean))];
  const classIds   = [...new Set(classSections.map(cs => cs.class_id).filter(Boolean))];
  const sectionIds = [...new Set(classSections.map(cs => cs.section_id).filter(Boolean))];

  const [users, classRows, sectionRows] = await Promise.all([
    User.findAll({ where: { user_id: { [Op.in]: userIds } } }),
    AdminClass.findAll({ where: { class_id: { [Op.in]: classIds } } }),
    AdminSection.findAll({ where: { section_id: { [Op.in]: sectionIds } } }),
  ]);

  const userByUserId   = Object.fromEntries(users.map(u => [Number(u.user_id), u]));
  const classById      = Object.fromEntries(classRows.map(c => [Number(c.class_id), c]));
  const sectionById    = Object.fromEntries(sectionRows.map(s => [Number(s.section_id), s]));

  // Enrich attempts
  const enrichedAttempts = attempts.map((a) => {
    const profile    = profileByStudentId[Number(a.student_id)];
    const cs         = classSectionByStudentId[Number(a.student_id)];
    const user       = profile ? userByUserId[Number(profile.user_id)] : null;
    const classRow   = cs ? classById[Number(cs.class_id)] : null;
    const sectionRow = cs ? sectionById[Number(cs.section_id)] : null;

    const score      = Number(a.total_marks_obtained ?? 0);
    const totalMarks = Number(a.total_marks_possible ?? assessment.total_marks ?? 0);

    return {
      attempt_id:   a.attempt_id,
      student_id:   a.student_id,
      student_name: user?.full_name ?? `Student #${a.student_id}`,
      roll_number:  profile?.roll_number ?? "—",
      class_name:   classRow?.class_name    ?? null,
      section_name: sectionRow?.section_name ?? null,
      score,
      total_marks:  totalMarks,
      percentage:   totalMarks > 0 ? Math.round((score / totalMarks) * 100) : 0,
      submitted_at: a.submitted_at,
      status:       a.status,
    };
  });

  const scores = enrichedAttempts.map(a => a.score);
  const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;

  return res.status(200).json(
    new ApiResponse(200, {
      assessment_title: assessment.title,
      total_marks:      assessment.total_marks,
      total_students:   enrichedAttempts.length,
      avg_score:        Math.round(avg * 100) / 100,
      max_score:        Math.max(...scores),
      min_score:        Math.min(...scores),
      attempts:         enrichedAttempts,
    }, "Assessment results fetched")
  );
});
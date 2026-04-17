import express from "express";
import {
  createAssessment,
  deleteAssessment,
  getAssessment,
  getTeacherAssessments,
  reviewQuestion,
  approveAllQuestions,
  addQuestion,
  publishAssessment,
  assignAssessment,
  getStudentAssignedTests,
  startAttempt,
  submitAttempt,
  getAttemptResult,
  getAttemptQuestions,
  getAssignmentResults,
  getAssessmentResults,
  getAssessmentsByUser,
} from "../controllers/assessment.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(authMiddleware);

/* ─────────────────────────────────────────
   TEACHER routes
───────────────────────────────────────── */

// Get all assessments created by the logged-in teacher
// GET /api/assessments/teacher/my
// Optional filters: ?status=draft  ?class_id=2  ?subject_id=3
router.get("/teacher/my", getTeacherAssessments);

// Get all assessments for the logged-in user (works for Teacher + Student)
// GET /api/assessments/user/all
router.get("/user/all", getAssessmentsByUser);

// List active/upcoming/expired tests assigned to this student
// GET /api/assessments/student/assigned
router.get("/student/assigned", getStudentAssignedTests);

// Get all results for an assignment (Teacher/Admin)
// GET /api/assessments/assignment/:assignment_id/results
router.get("/assignment/:assignment_id/results", getAssignmentResults);

// Get result for one attempt (Student/Teacher)
// GET /api/assessments/attempt/:attempt_id/result
router.get("/attempt/:attempt_id/result", getAttemptResult);

// Open test / resume attempt
// POST /api/assessments/attempt/start
router.post("/attempt/start", startAttempt);

// Submit answers
// POST /api/assessments/attempt/submit
router.post("/attempt/submit", submitAttempt);

// Get questions for an in-progress attempt (includes hints, excludes correct_answer)
// GET /api/assessments/attempt/:attempt_id/questions
router.get("/attempt/:attempt_id/questions", getAttemptQuestions);

// Create assessment + AI-generate questions
// POST /api/assessments
router.post("/", createAssessment);

// Get single assessment with all questions
// GET /api/assessments/:assessment_id
router.get("/:assessment_id", getAssessment);

// All student results for an assessment (Teacher)
// GET /api/assessments/:assessment_id/all-results
router.get("/:assessment_id/all-results", getAssessmentResults);

// Delete (archive) an assessment — soft-deletes if students have attempts
// DELETE /api/assessments/:assessment_id
router.delete("/:assessment_id", deleteAssessment);

// Review a single question: approve | edit | delete | regenerate
// PATCH /api/assessments/questions/:question_id
router.patch("/questions/:question_id", reviewQuestion);

// Approve ALL pending questions in one shot
// PATCH /api/assessments/:assessment_id/questions/approve-all
router.patch("/:assessment_id/questions/approve-all", approveAllQuestions);

// Add a new question manually (auto-approved)
// POST /api/assessments/:assessment_id/questions
router.post("/:assessment_id/questions", addQuestion);

// Publish (blocks if any question is still pending)
// PATCH /api/assessments/:assessment_id/publish
router.patch("/:assessment_id/publish", publishAssessment);

// Assign to class + sections
// POST /api/assessments/:assessment_id/assign
router.post("/:assessment_id/assign", assignAssessment);

export default router;
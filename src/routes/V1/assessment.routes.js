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
} from "../../controllers/assessment.controller.js";
import { authMiddleware }  from "../../middlewares/auth.middleware.js";
import { requireFeature }  from "../../middlewares/feature.middleware.js";
import { activityMiddleware } from "../../middlewares/activity.middleware.js";

const router = express.Router();

// Apply auth to every route in this file
router.use(authMiddleware);
router.use(activityMiddleware);

// Apply feature gate to every route in this file
// Feature ID 13 = AI_ASSESSMENT
router.use(requireFeature(13));

/* ─────────────────────────────────────────
   TEACHER routes
───────────────────────────────────────── */
router.get("/teacher/my",                          getTeacherAssessments);
router.get("/user/all",                            getAssessmentsByUser);
router.get("/student/assigned",                    getStudentAssignedTests);
router.get("/assignment/:assignment_id/results",   getAssignmentResults);
router.get("/attempt/:attempt_id/result",          getAttemptResult);
router.post("/attempt/start",                      startAttempt);
router.post("/attempt/submit",                     submitAttempt);
router.get("/attempt/:attempt_id/questions",       getAttemptQuestions);
router.post("/",                                   createAssessment);
router.get("/:assessment_id",                      getAssessment);
router.get("/:assessment_id/all-results",          getAssessmentResults);
router.delete("/:assessment_id",                   deleteAssessment);
router.patch("/questions/:question_id",            reviewQuestion);
router.patch("/:assessment_id/questions/approve-all", approveAllQuestions);
router.post("/:assessment_id/questions",           addQuestion);
router.patch("/:assessment_id/publish",            publishAssessment);
router.post("/:assessment_id/assign",              assignAssessment);

export default router;
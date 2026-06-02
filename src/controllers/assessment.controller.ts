import { Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  createAssessmentService,
  deleteAssessmentService,
  getTeacherAssessmentsService,
  getAssessmentsByUserService,
  getAssessmentService,
  reviewQuestionService,
  approveAllQuestionsService,
  addQuestionService,
  publishAssessmentService,
  assignAssessmentService,
  getStudentAssignedTestsService,
  startAttemptService,
  submitAttemptService,
  getAttemptResultService,
  getAssignmentResultsService,
  getAttemptQuestionsService,
  getAssessmentResultsService,
} from "../services/assessment.service.js";

/* ═══════════════════════════════════════════════════
   TEACHER: Create assessment + AI-generate questions
   POST /api/assessments
═══════════════════════════════════════════════════ */
export const createAssessment = asyncHandler(async (req: Request, res: Response) => {
  const { user_id, school_id } = req.user;

  const result = await createAssessmentService(user_id, school_id, req.body);

  if (result.aiFailed) {
    return res.status(207).json(
      new ApiResponse(
        207,
        { assessment: result.assessment },
        "Assessment created but AI generation failed. Add questions manually."
      )
    );
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        assessment: {
          ...result.assessment!.toJSON(),
          class_name: result.classRow?.class_name ?? null,
        },
        questions: result.questions,
      },
      "Assessment created with AI questions"
    )
  );
});

/* ═══════════════════════════════════════════════════
   TEACHER: Delete (archive) an assessment
   DELETE /api/assessments/:assessment_id
═══════════════════════════════════════════════════ */
export const deleteAssessment = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;
  const { user_id } = req.user;

  const result = await deleteAssessmentService(assessment_id, user_id);

  if (result.archived) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { assessment_id: result.assessment_id, status: "archived" },
        "Assessment archived (students have attempts — data preserved)"
      )
    );
  }

  return res.status(200).json(
    new ApiResponse(200, { assessment_id: result.assessment_id }, "Assessment deleted successfully")
  );
});

/* ═══════════════════════════════════════════════════
   TEACHER: Get all assessments created by this teacher
   GET /api/assessments/teacher/my
═══════════════════════════════════════════════════ */
export const getTeacherAssessments = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.user;
  const { status, class_id, subject_id } = req.query as Record<string, string | undefined>;

  const data = await getTeacherAssessmentsService(user_id, { status, class_id, subject_id });

  return res.status(200).json(new ApiResponse(200, data, "Teacher assessments fetched"));
});

/* ═══════════════════════════════════════════════════
   ANY ROLE: Get all assessments for the logged-in user
   GET /api/assessments/user/all
═══════════════════════════════════════════════════ */
export const getAssessmentsByUser = asyncHandler(async (req: Request, res: Response) => {
  const { user_id, role } = req.user;
  const { status, class_id, subject_id } = req.query as Record<string, string | undefined>;

  const data = await getAssessmentsByUserService(user_id, role, { status, class_id, subject_id });

  return res.status(200).json(new ApiResponse(200, data, "Assessments fetched"));
});

/* ═══════════════════════════════════════════════════
   TEACHER: Get one assessment with all questions
   GET /api/assessments/:assessment_id
═══════════════════════════════════════════════════ */
export const getAssessment = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;

  const data = await getAssessmentService(assessment_id);

  return res.status(200).json(new ApiResponse(200, data, "Assessment fetched"));
});

/* ═══════════════════════════════════════════════════
   TEACHER: Review a single question
   PATCH /api/assessments/questions/:question_id
   action: approve | edit | delete | regenerate
═══════════════════════════════════════════════════ */
export const reviewQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { question_id } = req.params;

  const result = await reviewQuestionService(question_id, req.body);

  if (result.action === "delete") {
    return res.status(200).json(new ApiResponse(200, {}, "Question deleted"));
  }

  const messages: Record<string, string> = {
    approve: "Question approved",
    edit: "Question updated",
    regenerate: "Question regenerated",
  };

  return res.status(200).json(
    new ApiResponse(200, { question: result.question }, messages[result.action] ?? "Done")
  );
});

/* ═══════════════════════════════════════════════════
   TEACHER: Approve ALL pending questions at once
   PATCH /api/assessments/:assessment_id/questions/approve-all
═══════════════════════════════════════════════════ */
export const approveAllQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;

  const updatedCount = await approveAllQuestionsService(assessment_id);

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
export const addQuestion = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;

  const question = await addQuestionService(assessment_id, req.body);

  return res.status(201).json(
    new ApiResponse(201, { question }, "Question added and approved")
  );
});

/* ═══════════════════════════════════════════════════
   TEACHER: Publish assessment
   PATCH /api/assessments/:assessment_id/publish
═══════════════════════════════════════════════════ */
export const publishAssessment = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;

  const assessment = await publishAssessmentService(assessment_id);

  return res.status(200).json(new ApiResponse(200, { assessment }, "Assessment published"));
});

/* ═══════════════════════════════════════════════════
   TEACHER: Assign to class/sections
   POST /api/assessments/:assessment_id/assign
═══════════════════════════════════════════════════ */
export const assignAssessment = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.user;
  const { assessment_id } = req.params;

  const result = await assignAssessmentService(user_id, assessment_id, req.body);

  return res.status(201).json(new ApiResponse(201, result, "Assessment assigned"));
});

/* ═══════════════════════════════════════════════════
   STUDENT: Get assigned tests (within time window)
   GET /api/assessments/student/assigned
═══════════════════════════════════════════════════ */
export const getStudentAssignedTests = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.user;

  const data = await getStudentAssignedTestsService(user_id);

  return res.status(200).json(new ApiResponse(200, data, "Assigned tests fetched"));
});

/* ═══════════════════════════════════════════════════
   STUDENT: Start / resume attempt
   POST /api/assessments/attempt/start
═══════════════════════════════════════════════════ */
export const startAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.user;
  const { assignment_id } = req.body;

  const result = await startAttemptService(user_id, assignment_id);

  return res.status(200).json(
    new ApiResponse(200, result, "Attempt started")
  );
});

/* ═══════════════════════════════════════════════════
   STUDENT: Submit attempt
   POST /api/assessments/attempt/submit
═══════════════════════════════════════════════════ */
export const submitAttempt = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.user;

  const { attempt, assignment, answerRows, totalObtained } = await submitAttemptService(
    user_id,
    req.body
  );

  const response: Record<string, unknown> = {
    attempt_id: attempt.attempt_id,
    submitted_at: attempt.submitted_at,
    total_marks_obtained: totalObtained,
    total_marks_possible: attempt.total_marks_possible,
    percentage: attempt.total_marks_possible
      ? Math.round((totalObtained / attempt.total_marks_possible) * 100)
      : 0,
  };

  if (assignment?.show_result_immediately) response.answers = answerRows;

  return res.status(200).json(new ApiResponse(200, response, "Attempt submitted successfully"));
});

/* ═══════════════════════════════════════════════════
   STUDENT / TEACHER: Result for one attempt
   GET /api/assessments/attempt/:attempt_id/result
═══════════════════════════════════════════════════ */
export const getAttemptResult = asyncHandler(async (req: Request, res: Response) => {
  const { attempt_id } = req.params;
  const { user_id, role } = req.user;

  const data = await getAttemptResultService(attempt_id, user_id, role);

  return res.status(200).json(new ApiResponse(200, data, "Result fetched"));
});

/* ═══════════════════════════════════════════════════
   TEACHER / ADMIN: All results for an assignment
   GET /api/assessments/assignment/:assignment_id/results
═══════════════════════════════════════════════════ */
export const getAssignmentResults = asyncHandler(async (req: Request, res: Response) => {
  const { assignment_id } = req.params;

  const data = await getAssignmentResultsService(assignment_id);

  return res.status(200).json(new ApiResponse(200, data, "Assignment results fetched"));
});

/* ═══════════════════════════════════════════════════
   STUDENT: Get questions for an existing attempt
   GET /api/assessments/attempt/:attempt_id/questions
═══════════════════════════════════════════════════ */
export const getAttemptQuestions = asyncHandler(async (req: Request, res: Response) => {
  const { attempt_id } = req.params;
  const { user_id } = req.user;

  const data = await getAttemptQuestionsService(attempt_id, user_id);

  return res.status(200).json(new ApiResponse(200, data, "Questions fetched"));
});

/* ═══════════════════════════════════════════════════
   TEACHER: All student results for one assessment
   GET /api/assessments/:assessment_id/all-results
═══════════════════════════════════════════════════ */
export const getAssessmentResults = asyncHandler(async (req: Request, res: Response) => {
  const { assessment_id } = req.params;

  const data = await getAssessmentResultsService(assessment_id);

  return res.status(200).json(new ApiResponse(200, data, "Assessment results fetched"));
});
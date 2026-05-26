import express from "express";
import { authMiddleware } from "../middlewares/auth.middleware.ts";
import multer from "multer";
import {
  generatePracticeQuestionsController,
  submitAnswerController,
  testResultController,
} from "../controllers/generatePracticeQuestions.controller.ts";

import {
  chatbotController,
  feedbackThumbUpController,
  feedbackThumbDownController,
} from "../controllers/chatbot.controller.ts";
import { practiceQuestionsLog } from "../middlewares/practiceQuestionsLog.middleware.js";

import rateLimitWithToken from "../middlewares/rateLimiteWithToken.middleware.ts";
import { voiceBotController } from "../controllers/voiceBot.controller.ts";
import { chatbotLogs } from "../middlewares/chatbotLogs.middleware.js";
import { tutorLogs } from "../middlewares/tutorLogs.middleware.ts";
const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.post(
  "/practice/questions",
  authMiddleware,
  practiceQuestionsLog,
  // rateLimit,
  generatePracticeQuestionsController,
);

router.post(
  "/ai/gini",
  authMiddleware,
  upload.single("file"),
  chatbotLogs,
  rateLimitWithToken,
  chatbotController,
);

router.post(
  "/voice-bot",
  authMiddleware,
  upload.single("user_audio"),
  tutorLogs,
  voiceBotController,
);
router.post(
  "/ai/feedback/thumbs-up",
  authMiddleware,
  feedbackThumbUpController,
);
router.post("/ai/feedback", authMiddleware, feedbackThumbDownController);
router.post(
  "/practice/questions/answer-submit",
  authMiddleware,
  submitAnswerController,
);
router.get(
  "/practice/questions/test/result/:testId",
  authMiddleware,
  testResultController,
);
export default router;

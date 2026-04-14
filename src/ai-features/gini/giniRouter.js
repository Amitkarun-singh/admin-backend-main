import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import multer from "multer";
import {
  generatePracticeQuestionsController,
  submitAnswerController,
  testResultController,
} from "./practiceQuestions/generatePracticeQuestions.controller.js";

import {
  chatbotController,
  feedbackThumbUpController,
  feedbackThumbDownController,
} from "./chatbot/chatbotController.js";
import { practiceQuestionsLog } from "../middleware/practiceQuestionsLog.js";
import { rateLimit } from "../middleware/rateLimite.js";
import { voiceBotController } from "./voiceBot/voiceBotController.js";
import { chatbotLogs } from "../middleware/chatbotLogs.js";

const router = express.Router();

router.post(
  "/practice/questions",
  authMiddleware,
  practiceQuestionsLog,
  // rateLimit,
  generatePracticeQuestionsController,
);

router.post("/ai/gini", authMiddleware, chatbotLogs, chatbotController);
const upload = multer({ storage: multer.memoryStorage() });
router.post(
  "/voice-bot",
  authMiddleware,
  upload.single("user_audio"),
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

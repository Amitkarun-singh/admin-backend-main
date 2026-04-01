import express from "express";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

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

router.post("/ai/gini", chatbotLogs, chatbotController);
router.post("/voice-bot", voiceBotController);
router.post("/ai/feedback/thumbs-up", feedbackThumbUpController);
router.post("/ai/feedback", feedbackThumbDownController);
router.post("/practice/questions/answer-submit", submitAnswerController);
router.get("/practice/questions/test/result/:testId", testResultController);
export default router;

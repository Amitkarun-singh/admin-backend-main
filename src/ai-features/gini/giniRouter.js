import express from "express";

import { generatePracticeQuestionsController } from "./practiceQuestions/generatePracticeQuestions.controller.js";
import {
  chatbotController,
  feedbackThumbUpController,
  feedbackThumbDownController,
} from "./chatbot/chatbotController.js";
import { logging } from "../middleware/Logging.js";
import { rateLimit } from "../middleware/rateLimite.js";
import { voiceBotController } from "./voiceBot/voiceBotController.js";

const router = express.Router();

router.post(
  "/practice/questions",
  // logging,
  rateLimit,
  generatePracticeQuestionsController,
);

router.post("/ai/gini", chatbotController);
router.post("/voice-bot", voiceBotController);
router.post("/ai/feedback/thumbs-up", feedbackThumbUpController);
router.post("/ai/feedback", feedbackThumbDownController);
export default router;

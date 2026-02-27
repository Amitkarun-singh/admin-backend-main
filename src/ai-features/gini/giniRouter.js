import express from "express";

import { generatePracticeQuestionsController } from "./practiceQuestions/generatePracticeQuestions.controller.js";
import { chatbotController } from "./chatbot/chatbotController.js";
import { logging } from "../middleware/Logging.js";
import { rateLimit } from "../middleware/rateLimite.js";
const router = express.Router();

router.post(
  "/practice/questions",
  // logging,
  rateLimit,
  generatePracticeQuestionsController,
);

router.post("/ai/gini", chatbotController);
export default router;

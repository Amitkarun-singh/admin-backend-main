import express from "express";

import { generatePracticeQuestionsController } from "./practiceQuestions/generatePracticeQuestions.controller.js";
import { chatbotController } from "./chatbot/chatbotController.js";
import { logging } from "../middleware/Logging.js";
const router = express.Router();

router.post(
  "/practice/questions",
  logging,
  generatePracticeQuestionsController,
);

router.post("/ai/gini", chatbotController);
export default router;

import express from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { generateSummary } from "../controllers/summarizer.controller.js";
import { aiLogger } from "../middlewares/aiLogger.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// user sends language + files
router.post("/summarize", authMiddleware, aiLogger("summarizer", "generate_summary"), upload.single("file"), generateSummary);

export default router;
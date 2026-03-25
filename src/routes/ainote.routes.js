import express from "express";
import {
    getLanguages,
    getClasses,
    getSubjects,
    getChapters,
    getAiNotes,
    generateAiNotes, // 👈 add this
} from "../controllers/ainote.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { aiLogger } from "../middlewares/aiLogger.middleware.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

// Dropdown APIs
router.get("/languages", authMiddleware, aiLogger("ai_notes", "generate_notes"), getLanguages);
router.get("/classes", authMiddleware, aiLogger("ai_notes", "generate_notes"), getClasses);
router.get("/subjects", authMiddleware, aiLogger("ai_notes", "generate_notes"), getSubjects);
router.get("/chapters",authMiddleware, aiLogger("ai_notes", "generate_notes"), getChapters);

// Generate AI notes (Gemini)
router.post("/generate", authMiddleware, aiLogger("ai_notes", "generate_notes"), upload.fields([
    { name: "notes", maxCount: 20 },
    { name: "books", maxCount: 20 },
]), generateAiNotes); // 👈 new route

// Final notes fetch (optional old system)
router.get("/", authMiddleware, aiLogger("ai_notes", "generate_notes"), getAiNotes);

export default router;

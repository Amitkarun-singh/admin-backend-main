import express from "express";
import {
    getLanguages,
    getClasses,
    getSubjects,
    getChapters,
    getAiNotes,
    generateAiNotes, // 👈 add this
} from "../controllers/ainote.controller.js";

const router = express.Router();

// Dropdown APIs
router.get("/languages", getLanguages);
router.get("/classes", getClasses);
router.get("/subjects", getSubjects);
router.get("/chapters", getChapters);

// Generate AI notes (Gemini)
router.post("/generate", generateAiNotes); // 👈 new route

// Final notes fetch (optional old system)
router.get("/", getAiNotes);

export default router;

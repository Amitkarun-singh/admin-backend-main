import express from "express";
import {
  getLanguages,
  getClasses,
  getSubjects,
  getChapters,
  getAiNotes,
  createAiNotes,
} from "../controllers/ainote.controller.js";
import { upload }             from "../middlewares/multer.middleware.js";
import { aiLogger }           from "../middlewares/aiLogger.middleware.js";
import { authMiddleware }     from "../middlewares/auth.middleware.js";
import { requireFeature }     from "../middlewares/feature.middleware.js";
import { activityMiddleware } from "../middlewares/activity.middleware.js";

const router = express.Router();

// ── Auth + feature guard (Feature ID 15 = AI_NOTES) ─────────────────────────
// router.use(authMiddleware);
// router.use(requireFeature(15));
// router.use(activityMiddleware);

// ── Cascade dropdown endpoints ───────────────────────────────────────────────
router.get("/languages", aiLogger("ai_notes_new", "view"), getLanguages);
router.get("/classes",   aiLogger("ai_notes_new", "view"), getClasses);
router.get("/subjects",  aiLogger("ai_notes_new", "view"), getSubjects);
router.get("/chapters",  aiLogger("ai_notes_new", "view"), getChapters);

// ── Manual note creation (user fills the form — no AI generation) ────────────
router.post(
  "/create",
  aiLogger("ai_notes_new", "create_note"),
  upload.fields([
    { name: "notes", maxCount: 20 },  // full-notes PDFs (one per chapter)
    { name: "books", maxCount: 20 },  // book PDFs (one per chapter)
  ]),
  createAiNotes
);

// ── Fetch notes (with signed S3 URLs) ────────────────────────────────────────
router.get("/", aiLogger("ai_notes_new", "view"), getAiNotes);

export default router;
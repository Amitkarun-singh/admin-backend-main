import express from "express";
import {
  getLanguages,
  getClasses,
  getSubjects,
  getChapters,
  getAiNotes,
  generateAiNotes,
} from "../controllers/ainote.controller.js";
import { upload }          from "../middlewares/multer.middleware.js";
import { aiLogger }        from "../middlewares/aiLogger.middleware.js";
import { authMiddleware }  from "../middlewares/auth.middleware.js";
import { requireFeature }  from "../middlewares/feature.middleware.js";

const router = express.Router();

// Feature ID 15 = AI_NOTES
// Applied after auth so req.user is available inside requireFeature
router.use(authMiddleware);
router.use(requireFeature(15));

// Dropdown APIs (still gated — no point calling them if feature is off)
router.get("/languages", aiLogger("ai_notes", "generate_notes"), getLanguages);
router.get("/classes",   aiLogger("ai_notes", "generate_notes"), getClasses);
router.get("/subjects",  aiLogger("ai_notes", "generate_notes"), getSubjects);
router.get("/chapters",  aiLogger("ai_notes", "generate_notes"), getChapters);

// Generate AI notes
router.post(
  "/generate",
  aiLogger("ai_notes", "generate_notes"),
  upload.fields([
    { name: "notes", maxCount: 20 },
    { name: "books", maxCount: 20 },
  ]),
  generateAiNotes
);

// Final notes fetch
router.get("/", aiLogger("ai_notes", "generate_notes"), getAiNotes);

export default router;
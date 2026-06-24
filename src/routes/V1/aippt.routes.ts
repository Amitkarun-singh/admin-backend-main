import express from "express";
import {
  getLanguages,
  getAiPpts,
  createAiPpts,
} from "../../controllers/aippt.controller.js";
import { upload }             from "../../middlewares/multer.middleware.js";
import { authMiddleware }     from "../../middlewares/auth.middleware.js";
import { requireFeature }     from "../../middlewares/feature.middleware.js";
import { activityMiddleware } from "../../middlewares/activity.middleware.js";

const router = express.Router();

// ── Auth + feature guard ─────────────────────────────────────────────────────
// router.use(authMiddleware);
// router.use(requireFeature(XX));   // assign a feature ID for AI_PPT
// router.use(activityMiddleware);

// ── GET /ai-ppt/languages ────────────────────────────────────────────────────
// Distinct languages from the ai_ppt table (same as ai-notes/languages).
// Everything else (board, class, stream, subject, chapter) comes from
// the curriculum microservice directly on the frontend.
router.get("/languages", getLanguages);

// ── GET /ai-ppt ──────────────────────────────────────────────────────────────
// Fetch PPTs filtered by any combination of:
//   ?language=  &board=  &stream=  &class=  &subject=  &chapter_id=
router.get("/", getAiPpts);

// ── POST /ai-ppt ─────────────────────────────────────────────────────────────
// Upload one or more PPT files (multipart/form-data).
// Files field: "ppts" (up to 50 files)
// Body fields:
//   language, board             (strings)
//   stream, class, subject      (curriculum IDs as numbers)
//   chapter_ids  → JSON array of ints   e.g. "[12,45,67]"
//   topics       → JSON array of strs   e.g. '["Algebra","Geometry"]'
//   created_by   (optional, defaults to "Teacher")
router.post(
  "/",
  upload.fields([{ name: "ppts", maxCount: 50 }]),
  createAiPpts
);

export default router;
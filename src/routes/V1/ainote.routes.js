import express from "express";
import {
  getLanguages,
  getBoards,
  getStreams,
  getClasses,
  getSubjects,
  getChapters,
  getAiNotes,
  createAiNotes,
} from "../../controllers/ainote.controller.js";
import { upload }             from "../../middlewares/multer.middleware.js";
import { aiLogger }           from "../../middlewares/aiLogger.middleware.js";
import { authMiddleware }     from "../../middlewares/auth.middleware.js";
import { requireFeature }     from "../../middlewares/feature.middleware.js";
import { activityMiddleware } from "../../middlewares/activity.middleware.js";

const router = express.Router();

// ── Auth + feature guard (Feature ID 15 = AI_NOTES) ─────────────────────────
// router.use(authMiddleware);
// router.use(requireFeature(15));
// router.use(activityMiddleware);
// ── Dropdown chain (all public) ───────────────────────────────────────────
//
//  Step 1 — fetch available languages
router.get("/languages", getLanguages);
//
//  Step 2 — fetch boards for a language
//  ?language=
router.get("/boards", getBoards);
//
//  Step 3a — fetch classes (for class 10 and below, no stream needed)
//  ?language= &board=
router.get("/classes", getClasses);
//
//  Step 3b — fetch streams (only relevant for class 11 & 12)
//  ?language= &board=
router.get("/streams", getStreams);
//
//  Step 4 — fetch subjects
//  ?language= &board= &class=  (&stream=  when class is 11 or 12)
router.get("/subjects", getSubjects);
//
//  Step 5 — fetch chapters
//  ?language= &board= &class= &subject=  (&stream=  when class is 11 or 12)
router.get("/chapters", getChapters);

//  ?language= &board= &class= &subject= &topic= &stream=
router.get("/", getAiNotes);

router.post(
  "/",
  upload.fields([
    { name: "notes", maxCount: 50 },
    { name: "books", maxCount: 50 },
  ]),
  createAiNotes
);

export default router;
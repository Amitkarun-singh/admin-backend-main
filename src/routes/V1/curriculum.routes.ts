import express from "express";
import {
  classes,
  subject,
  stream,
  chapter,
  section,
  assignedClasses,
  assignedSubjects,
  assignedChapters,
  assignClassProxy,
  removeClassProxy,
  createSubjectProxy,
  deleteSubjectProxy,
  createChapterProxy,
  deleteChapterProxy,
} from "../../controllers/curriculum.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";

const router = express.Router();

// ─── Read: full catalogue (admin / teacher) ───────────────────────────────────
router.get("/class",                                         classes);
router.get("/class/:classId/subject",                      subject);
router.get("/stream",                                        stream);
router.get("/section",                                      section);
router.get("/class/:classId/subject/:subjectId/chapter",   chapter);

// ─── Read: assigned resources (student view) ──────────────────────────────────
router.get("/assigned/classes",                                              authMiddleware, assignedClasses);
router.get("/assigned/class/:classId/subjects",                              authMiddleware, assignedSubjects);
router.get("/assigned/class/:classId/subject/:subjectId/chapters",           authMiddleware, assignedChapters);

// ─── Write: class assignment ──────────────────────────────────────────────────
router.post("/assign-class",    authMiddleware, assignClassProxy);
router.delete("/remove-class",  authMiddleware, removeClassProxy);

// ─── Write: subject CRUD ──────────────────────────────────────────────────────
router.post("/subject",             authMiddleware, createSubjectProxy);
router.delete("/subject/:subjectId", authMiddleware, deleteSubjectProxy);

// ─── Write: chapter CRUD ──────────────────────────────────────────────────────
router.post("/chapter",              authMiddleware, createChapterProxy);
router.delete("/chapter/:chapterId", authMiddleware, deleteChapterProxy);

export default router;
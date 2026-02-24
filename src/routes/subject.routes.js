import express from "express";

import {
    addSubjectsWithChapters,
    getSubjectsByClassName,
    getChaptersByClassAndSubject,
    updateSubjectName,
    deleteSubjectFromClass,
    addChaptersToSubject,
    updateChapter,
    deleteChapter
} from "../controllers/subject.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const router = express.Router();

/* =====================================================
   ADD MULTIPLE SUBJECTS + CHAPTERS USING CLASS NAME
   ===================================================== */
router.post(
    "/subjects",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    addSubjectsWithChapters
);

/* =====================================================
   GET ALL SUBJECTS BY CLASS NAME
   Example: /subjects/6
   ===================================================== */
router.get(
    "/subjects/:class_name",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    getSubjectsByClassName
);

/* =====================================================
   GET ALL CHAPTERS BY CLASS NAME + SUBJECT ID
   Example: /subjects/6/chapters/3
   ===================================================== */
router.get(
    "/subjects/:class_name/chapters/:subject_id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    getChaptersByClassAndSubject
);

/* =====================================================
   UPDATE SUBJECT NAME
   Example: PUT /subjects/3
   ===================================================== */
router.put(
    "/subjects/:subject_id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    updateSubjectName
);

/* =====================================================
   DELETE SUBJECT FROM CLASS
   Example: DELETE /subjects/6/3
   ===================================================== */
router.delete(
    "/subjects/:class_name/:subject_id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    deleteSubjectFromClass
);

/* =====================================================
   ADD CHAPTERS TO SUBJECT
   Example: POST /subjects/3/chapters
   ===================================================== */
router.post(
    "/subjects/:subject_id/chapters",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    addChaptersToSubject
);

/* =====================================================
   UPDATE CHAPTER
   Example: PUT /chapters/10
   ===================================================== */
router.put(
    "/chapters/:chapter_id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    updateChapter
);

/* =====================================================
   DELETE CHAPTER
   Example: DELETE /chapters/10
   ===================================================== */
router.delete(
    "/chapters/:chapter_id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    deleteChapter
);

export default router;
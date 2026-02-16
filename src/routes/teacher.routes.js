import express from "express";
import {
  createTeacher,
  bulkTeacherUpload,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher
} from "../controllers/teacher.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

/* =====================================================
   TEACHER ROUTES
   ===================================================== */

// Create single teacher
router.post(
  "/teacher",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  createTeacher
);

// Bulk upload teachers (Excel)
router.post(
  "/teachers/bulk",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  upload.single("file"),
  bulkTeacherUpload
);

// Get all teachers
router.get(
  "/teachers",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getAllTeachers
);

// Get single teacher
router.get(
  "/teacher/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getTeacherById
);

// Update teacher
router.put(
  "/teacher/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  updateTeacher
);

// Delete teacher
router.delete(
  "/teacher/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  deleteTeacher
);

export default router;

import express from "express";
import {
  createStudent,
  bulkStudentUpload,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent
} from "../controllers/student.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

/* =====================================================
   STUDENT ROUTES
   ===================================================== */

// Create single student
router.post(
  "/student",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  createStudent
);

// Bulk upload students (Excel)
router.post(
  "/students/bulk",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  upload.single("file"),
  bulkStudentUpload
);

// Get all students
router.get(
  "/students",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getAllStudents
);

// Get single student
router.get(
  "/student/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getStudentById
);

// Update student
router.put(
  "/student/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  updateStudent
);

// Delete student
router.delete(
  "/student/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  deleteStudent
);

export default router;

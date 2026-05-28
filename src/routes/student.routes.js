import express from "express";
import {
  createStudent,
  bulkStudentUpload,
  getAllStudents,
  getStudentById,
  getStudentProfile,
  getStudentAnalytics,
  updateStudent,
  deleteStudent
} from "../controllers/student.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import upload from "../middlewares/upload.middleware.js";
import { activityMiddleware } from "../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

router.post("/student",       authMiddleware, requirePermission("MANAGE_SCHOOL"), createStudent);
router.post("/students/bulk", authMiddleware, requirePermission("MANAGE_SCHOOL"), upload.single("file"), bulkStudentUpload);
router.get("/students",       authMiddleware, requirePermission("MANAGE_SCHOOL"), getAllStudents);
router.get("/student/:id",    authMiddleware, requirePermission("MANAGE_SCHOOL"), getStudentById);

// ── new ──
router.get("/student/:id/profile",   authMiddleware, requirePermission("MANAGE_SCHOOL"), getStudentProfile);
router.get("/student/:id/analytics", authMiddleware, requirePermission("MANAGE_SCHOOL"), getStudentAnalytics);

router.put("/student/:id",    authMiddleware, requirePermission("MANAGE_SCHOOL"), updateStudent);
router.delete("/student/:id", authMiddleware, requirePermission("MANAGE_SCHOOL"), deleteStudent);

export default router;
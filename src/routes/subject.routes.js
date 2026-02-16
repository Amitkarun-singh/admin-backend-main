import express from "express";
import {
  createSubject,
  getAllSubjects,
  updateSubject,
  deleteSubject
} from "../controllers/course.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const router = express.Router();

/* =====================================================
   SUBJECT ROUTES
   ===================================================== */

// Create subject
router.post(
  "/subject",
  authMiddleware,
  requirePermission("MANAGE_SUBJECTS"),
  createSubject
);

// Get all subjects
router.get(
  "/subjects",
  authMiddleware,
  requirePermission("MANAGE_SUBJECTS"),
  getAllSubjects
);

// Update subject
router.put(
  "/subject/:id",
  authMiddleware,
  requirePermission("MANAGE_SUBJECTS"),
  updateSubject
);

// Delete subject
router.delete(
  "/subject/:id",
  authMiddleware,
  requirePermission("MANAGE_SUBJECTS"),
  deleteSubject
);

export default router;

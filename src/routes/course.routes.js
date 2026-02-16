import express from "express";
import {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  deleteCourse
} from "../controllers/course.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const router = express.Router();

/* =====================================================
   COURSE ROUTES
   ===================================================== */

// Create course
router.post(
  "/course",
  authMiddleware,
  requirePermission("MANAGE_COURSES"),
  createCourse
);

// Get all courses
router.get(
  "/courses",
  authMiddleware,
  requirePermission("MANAGE_COURSES"),
  getAllCourses
);

// Get single course
router.get(
  "/course/:id",
  authMiddleware,
  requirePermission("MANAGE_COURSES"),
  getCourseById
);

// Update course
router.put(
  "/course/:id",
  authMiddleware,
  requirePermission("MANAGE_COURSES"),
  updateCourse
);

// Delete course
router.delete(
  "/course/:id",
  authMiddleware,
  requirePermission("MANAGE_COURSES"),
  deleteCourse
);

export default router;

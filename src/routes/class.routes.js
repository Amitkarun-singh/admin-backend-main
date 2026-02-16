import express from "express";
import {
    createClass,
    bulkCreateClasses,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass
} from "../controllers/course.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const router = express.Router();

// Create class
router.post(
    "/class",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    createClass
);

// Create multiple classes with sections (bulk)
router.post(
    "/classes/bulk",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    bulkCreateClasses
);

// Get all classes
router.get(
    "/classes",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    getAllClasses
);

// Get single class
router.get(
    "/class/:id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    getClassById
);

// Update class
router.put(
    "/class/:id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    updateClass
);

// Delete class (with cascade logic)
router.delete(
    "/class/:id",
    authMiddleware,
    requirePermission("MANAGE_SCHOOL"),
    deleteClass
);

export default router;

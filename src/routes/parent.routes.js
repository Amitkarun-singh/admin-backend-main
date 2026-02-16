import express from "express";
import {
  getAllParents,
  getParentById,
  updateParent,
  deleteParent
} from "../controllers/parent.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";

const router = express.Router();

/* =====================================================
   PARENT ROUTES
   ===================================================== */

// Get all parents
router.get(
  "/parents",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getAllParents
);

// Get single parent
router.get(
  "/parent/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getParentById
);

// Update parent
router.put(
  "/parent/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  updateParent
);

// Delete parent
router.delete(
  "/parent/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  deleteParent
);

export default router;

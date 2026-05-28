import express from "express";
import {
  getAllParents,
  getParentById,
  getParentProfile,
  updateParent,
  deleteParent
} from "../controllers/parent.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";
import { requirePermission } from "../middlewares/permission.middleware.js";
import { activityMiddleware } from "../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

router.get("/parents",          authMiddleware, requirePermission("MANAGE_SCHOOL"), getAllParents);
router.get("/parent/:id",       authMiddleware, requirePermission("MANAGE_SCHOOL"), getParentById);

// ── new ──
router.get("/parent/:id/profile", authMiddleware, requirePermission("MANAGE_SCHOOL"), getParentProfile);

router.put("/parent/:id",       authMiddleware, requirePermission("MANAGE_SCHOOL"), updateParent);
router.delete("/parent/:id",    authMiddleware, requirePermission("MANAGE_SCHOOL"), deleteParent);

export default router;
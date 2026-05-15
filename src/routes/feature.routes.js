import express from "express";

import {
  getMySchoolFeatures,
  getOverrides,
  setOverride,
  deleteOverride,
  bulkSetClassOverrides,
  bulkSetSectionOverrides,
  getMyAccess,
} from "../controllers/feature.controller.js";

import { authMiddleware }      from "../middlewares/auth.middleware.js";
import { requirePermission }   from "../middlewares/permission.middleware.js";
import { activityMiddleware }  from "../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

/* ─────────────────────────────────────────────────────────────
   SCHOOL ADMIN ROUTES
   requirePermission("MANAGE_SCHOOL") — already exists in your codebase
   ───────────────────────────────────────────────────────────── */

/* See which features my school has access to */
router.get(
  "/my-school",
  authMiddleware,
  // requirePermission("MANAGE_SCHOOL"),
  getMySchoolFeatures
);

/* List overrides my school has set
   Optional query: ?feature_id=1&target_type=class */
router.get(
  "/overrides",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  getOverrides
);

/* Create or update a single override (class / section / user / role) */
router.post(
  "/overrides",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  setOverride
);

/* Remove a specific override */
router.delete(
  "/overrides/:id",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  deleteOverride
);

/* Bulk set overrides for an entire class */
router.post(
  "/overrides/bulk-class",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  bulkSetClassOverrides
);

/* Bulk set overrides for an entire section */
router.post(
  "/overrides/bulk-section",
  authMiddleware,
  requirePermission("MANAGE_SCHOOL"),
  bulkSetSectionOverrides
);

/* ─────────────────────────────────────────────────────────────
   ANY AUTHENTICATED USER
   ───────────────────────────────────────────────────────────── */

/* What features can the logged-in user access? */
router.get(
  "/my-access",
  authMiddleware,
  getMyAccess
);

export default router;
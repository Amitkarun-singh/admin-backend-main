import { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse.ts";
import { asyncHandler } from "../utils/asyncHandler.ts";

import {
  getMySchoolFeaturesService,
  getOverridesService,
  setOverrideService,
  deleteOverrideService,
  bulkSetClassOverridesService,
  bulkSetSectionOverridesService,
  getMyAccessService,
} from "../services/feature.service.ts";

/* ═══════════════════════════════════════════════════
   5. GET MY SCHOOL'S FEATURES  (school admin)
   GET /api/features/my-school
═══════════════════════════════════════════════════ */
export const getMySchoolFeatures = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = req.user;

  const features = await getMySchoolFeaturesService(school_id);

  return res
    .status(200)
    .json(new ApiResponse(200, features, "School features fetched"));
});

/* ═══════════════════════════════════════════════════
   6. GET OVERRIDES  (school admin)
   GET /api/features/overrides
═══════════════════════════════════════════════════ */
export const getOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = req.user;
  const { feature_id, target_type } = req.query as Record<string, string | undefined>;

  const overrides = await getOverridesService(school_id, { feature_id, target_type });

  return res
    .status(200)
    .json(new ApiResponse(200, overrides, "Overrides fetched"));
});

/* ═══════════════════════════════════════════════════
   7. CREATE / UPDATE OVERRIDE  (school admin)
   POST /api/features/overrides
═══════════════════════════════════════════════════ */
export const setOverride = asyncHandler(async (req: Request, res: Response) => {
  const { school_id, user_id } = req.user;

  const result = await setOverrideService(school_id, user_id, req.body);

  return res.status(200).json(
    new ApiResponse(
      200,
      result.record,
      `Feature "${result.featureName}" ${result.is_enabled ? "enabled" : "disabled"} for ${result.target_type}`
    )
  );
});

/* ═══════════════════════════════════════════════════
   8. DELETE OVERRIDE  (school admin)
   DELETE /api/features/overrides/:id
═══════════════════════════════════════════════════ */
export const deleteOverride = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = req.user;
  const { id } = req.params;

  await deleteOverrideService(id, school_id);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Override removed"));
});

/* ═══════════════════════════════════════════════════
   9. BULK SET CLASS OVERRIDES  (school admin)
   POST /api/features/overrides/bulk-class
═══════════════════════════════════════════════════ */
export const bulkSetClassOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { school_id, user_id } = req.user;

  const results = await bulkSetClassOverridesService(school_id, user_id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, results, "Class feature overrides updated"));
});

/* ═══════════════════════════════════════════════════
   10. BULK SET SECTION OVERRIDES  (school admin)
   POST /api/features/overrides/bulk-section
═══════════════════════════════════════════════════ */
export const bulkSetSectionOverrides = asyncHandler(async (req: Request, res: Response) => {
  const { school_id, user_id } = req.user;

  const results = await bulkSetSectionOverridesService(school_id, user_id, req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, results, "Section feature overrides updated"));
});

/* ═══════════════════════════════════════════════════
   11. WHAT CAN I ACCESS?  (any user)
   GET /api/features/my-access
═══════════════════════════════════════════════════ */
export const getMyAccess = asyncHandler(async (req: Request, res: Response) => {
  const { user_id, school_id, role } = req.user;

  const resolved = await getMyAccessService(user_id, school_id, role);

  return res
    .status(200)
    .json(new ApiResponse(200, resolved, "Feature access fetched"));
});
import { Op } from "sequelize";
import sequelize from "../config/db.js";

import Feature         from "../models/feature.model.js";
import SchoolFeature   from "../models/school_feature.model.js";
import FeatureOverride from "../models/feature_overrides.model.js";

import { ApiError }     from "../utils/ApiError.js";
import { ApiResponse }  from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ─────────────────────────────────────────────────────────────
   SCHOOL ADMIN CONTROLLERS
   ───────────────────────────────────────────────────────────── */

/* =====================================================
   5. GET MY SCHOOL'S FEATURES  (school admin)
      GET /api/features/my-school
      Returns ALL features with is_enabled per this school.
      Frontend must filter to only show is_enabled = true ones.
   ===================================================== */
export const getMySchoolFeatures = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const features = await sequelize.query(
    `SELECT
       f.id          AS feature_id,
       f.feature_name,
       f.description,
       f.is_ai,
       COALESCE(sf.is_enabled, 0) AS is_enabled,
       sf.enabled_at
     FROM features f
     LEFT JOIN school_features sf
            ON sf.feature_id = f.id AND sf.school_id = :sid
     ORDER BY f.id`,
    {
      replacements: { sid: school_id },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  return res.status(200).json(
    new ApiResponse(200, features, "School features fetched")
  );
});

/* =====================================================
   6. GET OVERRIDES FOR MY SCHOOL  (school admin)
      GET /api/features/overrides
      Optional query params: ?feature_id=14&target_type=class
   ===================================================== */
export const getOverrides = asyncHandler(async (req, res) => {
  const school_id              = req.user.school_id;
  const { feature_id, target_type } = req.query;

  const where = { school_id };
  if (feature_id)  where.feature_id  = feature_id;
  if (target_type) where.target_type = target_type;

  const overrides = await FeatureOverride.findAll({
    where,
    order: [["created_at", "DESC"]],
  });

  return res.status(200).json(
    new ApiResponse(200, overrides, "Overrides fetched")
  );
});

/* =====================================================
   7. CREATE / UPDATE AN OVERRIDE  (school admin)
      POST /api/features/overrides

      target_type = 'class'   → target_id   = class_id
      target_type = 'section' → target_id   = section_id
      target_type = 'user'    → target_id   = user_id
      target_type = 'role'    → target_role = 'STUDENT' | 'TEACHER' | 'PARENT'
   ===================================================== */
export const setOverride = asyncHandler(async (req, res) => {
  const school_id  = req.user.school_id;
  const granted_by = req.user.user_id;
  const { feature_id, target_type, target_id, target_role, is_enabled } = req.body;

  /* ── Validation ── */
  if (!feature_id || !target_type || is_enabled === undefined)
    throw new ApiError(400, "feature_id, target_type and is_enabled are required");

  const validTypes = ["class", "section", "user", "role"];
  if (!validTypes.includes(target_type))
    throw new ApiError(400, `target_type must be one of: ${validTypes.join(", ")}`);

  if (target_type === "role" && !target_role)
    throw new ApiError(400, "target_role is required when target_type is 'role'");

  if (target_type !== "role" && !target_id)
    throw new ApiError(400, "target_id is required for class / section / user overrides");

  /* ── School must have this feature enabled first ── */
  const schoolFeature = await SchoolFeature.findOne({
    where: { school_id, feature_id, is_enabled: true },
  });
  if (!schoolFeature)
    throw new ApiError(403, "Your school does not have access to this feature");

  /* ── Upsert ── */
  const findWhere = {
    school_id,
    feature_id,
    target_type,
    target_id:   target_type !== "role" ? (target_id   || null) : null,
    target_role: target_type === "role" ? (target_role || null) : null,
  };

  const [record, created] = await FeatureOverride.findOrCreate({
    where:    findWhere,
    defaults: { ...findWhere, is_enabled, granted_by },
  });

  if (!created) {
    record.is_enabled = is_enabled;
    record.granted_by = granted_by;
    await record.save();
  }

  const feature = await Feature.findByPk(feature_id, { attributes: ["feature_name"] });

  return res.status(200).json(
    new ApiResponse(
      200,
      record,
      `Feature "${feature?.feature_name}" ${is_enabled ? "enabled" : "disabled"} for ${target_type}`
    )
  );
});

/* =====================================================
   8. DELETE AN OVERRIDE  (school admin)
      DELETE /api/features/overrides/:id
   ===================================================== */
export const deleteOverride = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;
  const { id }    = req.params;

  const override = await FeatureOverride.findOne({ where: { id, school_id } });
  if (!override) throw new ApiError(404, "Override not found");

  await override.destroy();

  return res.status(200).json(
    new ApiResponse(200, {}, "Override removed")
  );
});

/* =====================================================
   9. BULK SET OVERRIDES FOR A CLASS  (school admin)
      POST /api/features/overrides/bulk-class
      Body: { class_id, features: [{ feature_id, is_enabled }] }
   ===================================================== */
export const bulkSetClassOverrides = asyncHandler(async (req, res) => {
  const school_id  = req.user.school_id;
  const granted_by = req.user.user_id;
  const { class_id, features } = req.body;

  if (!class_id || !Array.isArray(features) || !features.length)
    throw new ApiError(400, "class_id and features[] are required");

  const results = [];

  for (const { feature_id, is_enabled } of features) {
    const schoolFeature = await SchoolFeature.findOne({
      where: { school_id, feature_id, is_enabled: true },
    });
    if (!schoolFeature) continue; // skip features school doesn't have

    const findWhere = {
      school_id,
      feature_id,
      target_type: "class",
      target_id:   class_id,
      target_role: null,
    };
    const [record, created] = await FeatureOverride.findOrCreate({
      where:    findWhere,
      defaults: { ...findWhere, is_enabled, granted_by },
    });
    if (!created) {
      record.is_enabled = is_enabled;
      record.granted_by = granted_by;
      await record.save();
    }
    results.push(record);
  }

  return res.status(200).json(
    new ApiResponse(200, results, "Class feature overrides updated")
  );
});

/* =====================================================
   10. BULK SET OVERRIDES FOR A SECTION  (school admin)
       POST /api/features/overrides/bulk-section
       Body: { section_id, features: [{ feature_id, is_enabled }] }
   ===================================================== */
export const bulkSetSectionOverrides = asyncHandler(async (req, res) => {
  const school_id  = req.user.school_id;
  const granted_by = req.user.user_id;
  const { section_id, features } = req.body;

  if (!section_id || !Array.isArray(features) || !features.length)
    throw new ApiError(400, "section_id and features[] are required");

  const results = [];

  for (const { feature_id, is_enabled } of features) {
    const schoolFeature = await SchoolFeature.findOne({
      where: { school_id, feature_id, is_enabled: true },
    });
    if (!schoolFeature) continue;

    const findWhere = {
      school_id,
      feature_id,
      target_type: "section",
      target_id:   section_id,
      target_role: null,
    };
    const [record, created] = await FeatureOverride.findOrCreate({
      where:    findWhere,
      defaults: { ...findWhere, is_enabled, granted_by },
    });
    if (!created) {
      record.is_enabled = is_enabled;
      record.granted_by = granted_by;
      await record.save();
    }
    results.push(record);
  }

  return res.status(200).json(
    new ApiResponse(200, results, "Section feature overrides updated")
  );
});

/* ─────────────────────────────────────────────────────────────
   SHARED — ANY AUTHENTICATED USER
   ───────────────────────────────────────────────────────────── */

/* =====================================================
   11. WHAT CAN I ACCESS?  (any user)
       GET /api/features/my-access
       Resolution order: user > section > class > role > school default
   ===================================================== */
export const getMyAccess = asyncHandler(async (req, res) => {
  const { user_id, school_id, role } = req.user;

  /* Resolve class_id + section_id for students */
  let class_id   = null;
  let section_id = null;
  try {
    const [cs] = await sequelize.query(
      `SELECT class_id, section_id
       FROM   student_class_sections
       WHERE  student_id = (
         SELECT student_id FROM student_profiles WHERE user_id = :uid LIMIT 1
       )
       LIMIT 1`,
      { replacements: { uid: user_id }, type: sequelize.QueryTypes.SELECT }
    );
    class_id   = cs?.class_id   || null;
    section_id = cs?.section_id || null;
  } catch { /* non-student — skip */ }

  const features = await sequelize.query(
    `SELECT
       f.id          AS feature_id,
       f.feature_name,
       f.description,
       f.is_ai,
       COALESCE(sf.is_enabled, 0) AS school_enabled,

       /* Most-specific override wins: user > section > class > role */
       (SELECT fo.is_enabled
        FROM   feature_overrides fo
        WHERE  fo.school_id  = :sid
          AND  fo.feature_id = f.id
          AND  (
            (fo.target_type = 'user'    AND fo.target_id   = :uid)    OR
            (fo.target_type = 'section' AND fo.target_id   = :sec_id) OR
            (fo.target_type = 'class'   AND fo.target_id   = :cls_id) OR
            (fo.target_type = 'role'    AND fo.target_role = :role)
          )
        ORDER BY FIELD(fo.target_type, 'user', 'section', 'class', 'role')
        LIMIT 1
       ) AS override_enabled

     FROM features f
     LEFT JOIN school_features sf
            ON sf.feature_id = f.id AND sf.school_id = :sid
     ORDER BY f.id`,
    {
      replacements: {
        sid:    school_id,
        uid:    user_id,
        sec_id: section_id || 0,
        cls_id: class_id   || 0,
        role:   role,
      },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  /* Apply resolution */
  const resolved = features.map(f => ({
    feature_id:   f.feature_id,
    feature_name: f.feature_name,
    description:  f.description,
    is_ai:        !!f.is_ai,
    // If school disabled it → always false regardless of overrides
    is_enabled:   !f.school_enabled
      ? false
      : f.override_enabled !== null
        ? !!f.override_enabled
        : true,
  }));

  return res.status(200).json(
    new ApiResponse(200, resolved, "Feature access fetched")
  );
});
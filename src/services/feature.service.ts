import {
  featureRepo,
  schoolFeatureRepo,
  featureOverrideRepo,
  featureQueryRepo,
} from "../repositories/feature.repository.js";
import { ApiError } from "../utils/ApiError.js";

// ─── Inline types (derived from models) ──────────────────────────────────────

type TargetType = "class" | "section" | "role" | "user";

interface RawFeatureRow {
  feature_id:      number;
  feature_name:    string;
  description:     string | null;
  is_ai:           number | boolean;
  school_enabled:  number | boolean;
  override_enabled: number | boolean | null;
}

/* ═══════════════════════════════════════════════════
   5. getMySchoolFeatures
═══════════════════════════════════════════════════ */
export const getMySchoolFeaturesService = async (school_id: bigint | number) => {
  return featureQueryRepo.getSchoolFeatures(school_id);
};

/* ═══════════════════════════════════════════════════
   6. getOverrides
═══════════════════════════════════════════════════ */
export const getOverridesService = async (
  school_id: bigint | number,
  query: { feature_id?: string; target_type?: string }
) => {
  const where: Record<string, unknown> = { school_id };
  if (query.feature_id)  where.feature_id  = query.feature_id;
  if (query.target_type) where.target_type = query.target_type;

  return featureOverrideRepo.findAll(where);
};

/* ═══════════════════════════════════════════════════
   7. setOverride
═══════════════════════════════════════════════════ */
export const setOverrideService = async (
  school_id: bigint | number,
  granted_by: bigint | number,
  body: {
    feature_id?: number;
    target_type?: string;
    target_id?: bigint | number | null;
    target_role?: string | null;
    is_enabled?: boolean;
  }
) => {
  const { feature_id, target_type, target_id, target_role, is_enabled } = body;

  if (!feature_id || !target_type || is_enabled === undefined)
    throw new ApiError(400, "feature_id, target_type and is_enabled are required");

  const validTypes: TargetType[] = ["class", "section", "user", "role"];
  if (!validTypes.includes(target_type as TargetType))
    throw new ApiError(400, `target_type must be one of: ${validTypes.join(", ")}`);

  if (target_type === "role" && !target_role)
    throw new ApiError(400, "target_role is required when target_type is 'role'");

  if (target_type !== "role" && !target_id)
    throw new ApiError(400, "target_id is required for class / section / user overrides");

  const schoolFeature = await schoolFeatureRepo.findOne({
    school_id,
    feature_id,
    is_enabled: true,
  });
  if (!schoolFeature)
    throw new ApiError(403, "Your school does not have access to this feature");

  const findWhere = {
    school_id,
    feature_id,
    target_type,
    target_id:   target_type !== "role" ? (target_id   ?? null) : null,
    target_role: target_type === "role" ? (target_role ?? null) : null,
  };

  const [record, created] = await featureOverrideRepo.findOrCreate(findWhere, {
    ...findWhere,
    is_enabled,
    granted_by,
  });

  if (!created) {
    (record as unknown as Record<string, unknown>).is_enabled = is_enabled;
    (record as unknown as Record<string, unknown>).granted_by = granted_by;
    await (record as unknown as { save: () => Promise<void> }).save();
  }

  const feature = await featureRepo.findByPk(feature_id);

  return {
    record,
    featureName: (feature as unknown as Record<string, unknown> | null)?.feature_name ?? null,
    is_enabled,
    target_type,
  };
};

/* ═══════════════════════════════════════════════════
   8. deleteOverride
═══════════════════════════════════════════════════ */
export const deleteOverrideService = async (
  id: string,
  school_id: bigint | number
) => {
  const override = await featureOverrideRepo.findOne({ id, school_id });
  if (!override) throw new ApiError(404, "Override not found");

  await featureOverrideRepo.destroy(override);
};

/* ═══════════════════════════════════════════════════
   9. bulkSetClassOverrides
═══════════════════════════════════════════════════ */
export const bulkSetClassOverridesService = async (
  school_id: bigint | number,
  granted_by: bigint | number,
  body: {
    class_id?: number | string;
    features?: Array<{ feature_id: number; is_enabled: boolean }>;
  }
) => {
  const { class_id, features } = body;

  if (!class_id || !Array.isArray(features) || !features.length)
    throw new ApiError(400, "class_id and features[] are required");

  const results = [];

  for (const { feature_id, is_enabled } of features) {
    const schoolFeature = await schoolFeatureRepo.findOne({
      school_id,
      feature_id,
      is_enabled: true,
    });
    if (!schoolFeature) continue;

    const findWhere = {
      school_id,
      feature_id,
      target_type: "class",
      target_id:   class_id,
      target_role: null,
    };
    const [record, created] = await featureOverrideRepo.findOrCreate(findWhere, {
      ...findWhere,
      is_enabled,
      granted_by,
    });
    if (!created) {
      (record as unknown as Record<string, unknown>).is_enabled = is_enabled;
      (record as unknown as Record<string, unknown>).granted_by = granted_by;
      await (record as unknown as { save: () => Promise<void> }).save();
    }
    results.push(record);
  }

  return results;
};

/* ═══════════════════════════════════════════════════
   10. bulkSetSectionOverrides
═══════════════════════════════════════════════════ */
export const bulkSetSectionOverridesService = async (
  school_id: bigint | number,
  granted_by: bigint | number,
  body: {
    section_id?: number | string;
    features?: Array<{ feature_id: number; is_enabled: boolean }>;
  }
) => {
  const { section_id, features } = body;

  if (!section_id || !Array.isArray(features) || !features.length)
    throw new ApiError(400, "section_id and features[] are required");

  const results = [];

  for (const { feature_id, is_enabled } of features) {
    const schoolFeature = await schoolFeatureRepo.findOne({
      school_id,
      feature_id,
      is_enabled: true,
    });
    if (!schoolFeature) continue;

    const findWhere = {
      school_id,
      feature_id,
      target_type: "section",
      target_id:   section_id,
      target_role: null,
    };
    const [record, created] = await featureOverrideRepo.findOrCreate(findWhere, {
      ...findWhere,
      is_enabled,
      granted_by,
    });
    if (!created) {
      (record as unknown as Record<string, unknown>).is_enabled = is_enabled;
      (record as unknown as Record<string, unknown>).granted_by = granted_by;
      await (record as unknown as { save: () => Promise<void> }).save();
    }
    results.push(record);
  }

  return results;
};

/* ═══════════════════════════════════════════════════
   11. getMyAccess
═══════════════════════════════════════════════════ */
export const getMyAccessService = async (
  user_id: bigint | number,
  school_id: bigint | number,
  role: string
) => {
  let class_id   = 0;
  let section_id = 0;

  try {
    const rows = await featureQueryRepo.getStudentClassSection(user_id);
    const cs = rows[0];
    class_id   = cs?.class_id   ?? 0;
    section_id = cs?.section_id ?? 0;
  } catch { /* non-student — skip */ }

  const features = await featureQueryRepo.getUserAccess({
    school_id,
    user_id,
    section_id,
    class_id,
    role,
  });

  return (features as RawFeatureRow[]).map((f) => ({
    feature_id:   f.feature_id,
    feature_name: f.feature_name,
    description:  f.description,
    is_ai:        !!f.is_ai,
    is_enabled:   !f.school_enabled
      ? false
      : f.override_enabled !== null
        ? !!f.override_enabled
        : true,
  }));
};
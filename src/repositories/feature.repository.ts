import sequelize from "../config/db.js";
import { QueryTypes } from "sequelize";

import Feature         from "../models/feature.model.js";
import SchoolFeature   from "../models/school_feature.model.js";
import FeatureOverride from "../models/feature_overrides.model.js";

// ─── Inline types (derived from models) ──────────────────────────────────────

type TargetType = "class" | "section" | "role" | "user";

interface OverrideUpsertData {
  school_id: bigint | number;
  feature_id: number;
  target_type: TargetType;
  target_id?: bigint | number | null;
  target_role?: string | null;
  is_enabled: boolean;
  granted_by: bigint | number;
}

// ─── Feature ──────────────────────────────────────────────────────────────────

export const featureRepo = {
  findByPk: (id: number | string) =>
    Feature.findByPk(id, { attributes: ["feature_name"] }),
};

// ─── SchoolFeature ────────────────────────────────────────────────────────────

export const schoolFeatureRepo = {
  findOne: (where: Record<string, unknown>) =>
    SchoolFeature.findOne({ where }),
};

// ─── FeatureOverride ──────────────────────────────────────────────────────────

export const featureOverrideRepo = {
  findOne: (where: Record<string, unknown>) =>
    FeatureOverride.findOne({ where }),

  findAll: (where: Record<string, unknown>) =>
    FeatureOverride.findAll({ where, order: [["created_at", "DESC"]] }),

  findOrCreate: (findWhere: Record<string, unknown>, defaults: Record<string, unknown>) =>
    FeatureOverride.findOrCreate({ where: findWhere, defaults: defaults as any }),

  destroy: (instance: FeatureOverride) => instance.destroy(),
};

// ─── Raw SQL queries ──────────────────────────────────────────────────────────

export const featureQueryRepo = {
  /** GET /api/features/my-school — all features with school's is_enabled flag */
  getSchoolFeatures: (school_id: bigint | number) =>
    sequelize.query(
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
      { replacements: { sid: school_id }, type: QueryTypes.SELECT }
    ),

  /** GET /api/features/my-access — resolved access per user */
  getUserAccess: (params: {
    school_id: bigint | number;
    user_id: bigint | number;
    section_id: number;
    class_id: number;
    role: string;
  }) =>
    sequelize.query(
      `SELECT
         f.id          AS feature_id,
         f.feature_name,
         f.description,
         f.is_ai,
         COALESCE(sf.is_enabled, 0) AS school_enabled,
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
          sid:    params.school_id,
          uid:    params.user_id,
          sec_id: params.section_id || 0,
          cls_id: params.class_id   || 0,
          role:   params.role,
        },
        type: QueryTypes.SELECT,
      }
    ),

  /** Resolve class_id + section_id for a student user */
  getStudentClassSection: (user_id: bigint | number) =>
    sequelize.query(
      `SELECT class_id, section_id
       FROM   student_class_sections
       WHERE  student_id = (
         SELECT student_id FROM student_profiles WHERE user_id = :uid LIMIT 1
       )
       LIMIT 1`,
      { replacements: { uid: user_id }, type: QueryTypes.SELECT }
    ) as Promise<Array<{ class_id: number; section_id: number }>>,
};
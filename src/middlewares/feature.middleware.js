import sequelize     from "../config/db.js";
import SchoolFeature  from "../models/school_feature.model.js";
import { ApiError }   from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/*
  HOW THE TABLES CONNECT:
  ──────────────────────────────────────────────────────
  users                    → user_id  (PK)
       ↓ user_id
  student_profiles         → student_id (PK), user_id (FK)
       ↓ student_id
  student_class_section    → student_id (PK), class_id, section_id
  ──────────────────────────────────────────────────────

  There is NO user_id on student_class_section.
  To get class_id / section_id we must join through student_profiles.

  RESOLUTION ORDER (most specific wins):
    user > section > class > role > school default
*/

export const requireFeature = (feature_id) =>
  asyncHandler(async (req, res, next) => {
    const { user_id, school_id, role } = req.user;

    /* ─────────────────────────────────────────────────
       STEP 1 — School-level check
       Super admin controls this via school_features table.
       If is_enabled = 0 here → blocked for everyone in the school.
    ───────────────────────────────────────────────── */
    const schoolGrant = await SchoolFeature.findOne({
      where: { school_id, feature_id, is_enabled: true },
    });

    if (!schoolGrant) {
      throw new ApiError(
        403,
        "This feature is not available for your school."
      );
    }

    /* ─────────────────────────────────────────────────
       STEP 2 — Resolve class_id + section_id
       Only students have a class/section assignment.
       Join path: users → student_profiles → student_class_section
    ───────────────────────────────────────────────── */
    let class_id   = null;
    let section_id = null;

    if (role === "STUDENT") {
      try {
        const [cs] = await sequelize.query(
          `SELECT scs.class_id, scs.section_id
           FROM   student_profiles       sp
           JOIN   student_class_section  scs ON scs.student_id = sp.student_id
           WHERE  sp.user_id = :uid
           LIMIT  1`,
          {
            replacements: { uid: user_id },
            type: sequelize.QueryTypes.SELECT,
          }
        );
        class_id   = cs?.class_id   ?? null;
        section_id = cs?.section_id ?? null;
      } catch {
        /* student not yet assigned to a class — class/section overrides will not match */
      }
    }

    /* ─────────────────────────────────────────────────
       STEP 3 — Check feature_overrides
       FIELD() orders results so user override comes before
       section, section before class, class before role.
       We take only LIMIT 1 — the top row is the final answer.
    ───────────────────────────────────────────────── */
    const [override] = await sequelize.query(
      `SELECT is_enabled, target_type
       FROM   feature_overrides
       WHERE  school_id  = :sid
         AND  feature_id = :fid
         AND  (
           (target_type = 'user'    AND target_id   = :uid)    OR
           (target_type = 'section' AND target_id   = :sec_id) OR
           (target_type = 'class'   AND target_id   = :cls_id) OR
           (target_type = 'role'    AND target_role = :role)
         )
       ORDER BY FIELD(target_type, 'user', 'section', 'class', 'role')
       LIMIT 1`,
      {
        replacements: {
          sid:    school_id,
          fid:    feature_id,
          uid:    user_id,
          sec_id: section_id || 0,
          cls_id: class_id   || 0,
          role,
        },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    /* ─────────────────────────────────────────────────
       STEP 4 — Final decision
    ───────────────────────────────────────────────── */

    if (override !== undefined) {
      // An override exists — it is the FINAL decision, school grant no longer matters
      if (!override.is_enabled) {

        // Show a specific message based on what level blocked the user
        const messages = {
          user:    "You do not have access to this feature.",
          section: "This feature has been disabled for your section.",
          class:   "This feature has been disabled for your class.",
          role:    "This feature is not available for your role.",
        };

        throw new ApiError(
          403,
          messages[override.target_type] ?? "You do not have access to this feature."
        );
      }

      // Override says is_enabled = true → explicitly granted → allow
      return next();
    }

    // No override found at any level → school grant alone is enough → allow
    return next();
  });
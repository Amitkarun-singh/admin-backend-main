import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

/*
  No foreign key constraints in this model.

  Root cause of errno 150:
    - AdminSchool maps JS `school_id` → DB column `id` (BIGINT signed)
    - Any association targeting AdminSchool generates:
        FOREIGN KEY (school_id) REFERENCES schools(id)
    - Sequelize infers the FK type from the association, not this model,
      causing a type/reference mismatch → errno 150

  Solution: define NO associations for FeatureOverride in index.js.
  All queries use raw SQL so associations are not needed.
*/

export default sequelize.define(
  "FeatureOverride",
  {
    id: {
      type:          DataTypes.BIGINT,   // signed — matches schools.id pattern
      primaryKey:    true,
      autoIncrement: true,
    },
    school_id: {
      type:      DataTypes.BIGINT,       // signed BIGINT — matches schools.id
      allowNull: false,
    },
    feature_id: {
      type:      DataTypes.INTEGER,      // matches features.id
      allowNull: false,
    },
    target_type: {
      type:      DataTypes.ENUM("class", "section", "role", "user"),
      allowNull: false,
    },
    target_id: {
      type:      DataTypes.BIGINT,       // signed — avoids unsigned mismatch
      allowNull: true,
    },
    target_role: {
      type:      DataTypes.STRING(40),
      allowNull: true,
    },
    is_enabled: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
    },
    granted_by: {
      type:      DataTypes.BIGINT,       // signed — matches users.user_id
      allowNull: true,
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:   "feature_overrides",
    timestamps:  false,
    underscored: true,
    // No indexes defined here — add them manually in DB if needed:
    // ALTER TABLE feature_overrides
    //   ADD UNIQUE KEY uq_override (school_id, feature_id, target_type, target_id, target_role),
    //   ADD INDEX idx_school_feature (school_id, feature_id);
  }
);
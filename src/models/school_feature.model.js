import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define(
  "SchoolFeature",
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    school_id: {
      type:      DataTypes.BIGINT,
      allowNull: false,
    },
    feature_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    is_enabled: {
      type:         DataTypes.BOOLEAN,
      defaultValue: true,
    },
    enabled_at: {
      type:      DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName:   "school_features",
    timestamps:  false,
    underscored: true,
  }
);
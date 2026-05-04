import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define(
  "Feature",
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    feature_name: {
      type:      DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    is_ai: {
      type:         DataTypes.BOOLEAN,
      defaultValue: false,
    },
    created_at: {
      type:         DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:  "features",
    timestamps: false,
    underscored: true,
  }
);
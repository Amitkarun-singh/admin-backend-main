import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define(
  "AiUsageLog",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true
    },

    user_id: {
      type: DataTypes.BIGINT
    },

    feature: {
      type: DataTypes.ENUM("summarizer", "ai_notes")
    },

    action: {
      type: DataTypes.STRING
    },

    endpoint: {
      type: DataTypes.STRING
    },

    request_payload: {
      type: DataTypes.JSON
    },

    response_data: {          // ✅ required for your code
      type: DataTypes.JSON
    },

    response_status: {
      type: DataTypes.INTEGER
    },

    response_time_ms: {
      type: DataTypes.INTEGER
    },

    ip_address: {
      type: DataTypes.STRING
    }
  },
  {
    tableName: "ai_usage_logs",
    underscored: true,
    timestamps: true
  }
);
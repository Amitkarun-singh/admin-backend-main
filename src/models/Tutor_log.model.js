import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const TutorLog = sequelize.define(
  "TutorLog",
  {
    id: {
      type:          DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey:    true,
    },
    conversation_id: {
      type:      DataTypes.STRING(255),
      allowNull: false,
    },
    user_id: {
      type:      DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },
    method: {
      type:      DataTypes.STRING(10),
      allowNull: false,
    },
    url: {
      type:      DataTypes.TEXT,
      allowNull: false,
    },
    status_code: {
      type:      DataTypes.INTEGER,
      allowNull: true,
    },
    device: {
      type:      DataTypes.STRING(100),
      allowNull: true,
    },
    request_body: {
      type:      DataTypes.TEXT("long"),
      allowNull: true,
    },
    response_body: {
      type:      DataTypes.TEXT("long"),
      allowNull: true,
    },
    user_details: {
      type:      DataTypes.TEXT("long"),
      allowNull: true,
    },
    created_at: {
      type:         DataTypes.DATE,
      allowNull:    true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName:   "tutor_logs",
    timestamps:  false,   // we manage created_at manually
    underscored: true,
  }
);

export default TutorLog;
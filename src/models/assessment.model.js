import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Assessment = sequelize.define("Assessment", {
  assessment_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  school_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: "teacher user_id",
  },

  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  topic: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  difficulty: {
    type: DataTypes.ENUM("easy", "medium", "hard"),
    defaultValue: "medium",
  },

  total_marks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },

  time_limit_minutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "null = no limit",
  },

  question_types_allowed: {
    type: DataTypes.JSON,
    defaultValue: ["mcq"],
    comment: "['mcq','true_false']",
  },

  status: {
    type: DataTypes.ENUM("draft", "published", "archived"),
    defaultValue: "draft",
  },

  generated_by: {
    type: DataTypes.ENUM("AI", "TEACHER"),
    defaultValue: "AI",
  },
}, {
  tableName: "assessments",
  underscored: true,
  timestamps: true,
});

export default Assessment;
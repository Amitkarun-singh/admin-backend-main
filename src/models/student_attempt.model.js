import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export const StudentAttempt = sequelize.define("StudentAttempt", {
  attempt_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  assignment_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  student_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  started_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },

  submitted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  is_auto_submitted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "true if submitted on timer timeout",
  },

  total_marks_obtained: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
  },

  total_marks_possible: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },

  status: {
    type: DataTypes.ENUM("in_progress", "submitted"),
    defaultValue: "in_progress",
  },
}, {
  tableName: "student_attempts",
  underscored: true,
  timestamps: true,
});

export const StudentAnswer = sequelize.define("StudentAnswer", {
  answer_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  attempt_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  question_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  answer_text: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  is_correct: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: "null for essay type (manual grading)",
  },

  marks_obtained: {
    type: DataTypes.DECIMAL(6, 2),
    allowNull: true,
  },
}, {
  tableName: "student_answers",
  underscored: true,
  timestamps: true,
});
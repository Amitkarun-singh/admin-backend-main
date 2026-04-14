import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AssessmentQuestion = sequelize.define("AssessmentQuestion", {
  question_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  assessment_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  question_text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },

  question_type: {
    type: DataTypes.ENUM("mcq", "true_false", "short", "essay"),
    allowNull: false,
  },

  options: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: "[{key:'A',text:'...'}, ...] for MCQ/true_false",
  },

  correct_answer: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Option key for MCQ, or text for short/essay",
  },

  hint: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  marks: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },

  status: {
    type: DataTypes.ENUM("pending", "approved", "rejected"),
    defaultValue: "pending",
    comment: "Teacher review status",
  },

  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
}, {
  tableName: "assessment_questions",
  underscored: true,
  timestamps: true,
});

export default AssessmentQuestion;
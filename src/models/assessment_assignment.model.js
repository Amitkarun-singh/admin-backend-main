import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AssessmentAssignment = sequelize.define("AssessmentAssignment", {
  assignment_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },

  assessment_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },

  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },

  section_ids: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: "Array of section_id integers",
  },

  start_datetime: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  end_datetime: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  shuffle_questions: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  shuffle_options: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },

  show_result_immediately: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: "false = show only after end_datetime",
  },

  assigned_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    comment: "teacher user_id",
  },
}, {
  tableName: "assessment_assignments",
  underscored: true,
  timestamps: true,
});

export default AssessmentAssignment;
import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AssessmentAssignmentAttributes {
  assignment_id: bigint;
  assessment_id: bigint;
  class_id: number;
  section_ids: number[];
  start_datetime: Date;
  end_datetime: Date;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  show_result_immediately?: boolean;
  assigned_by: bigint;
}

interface AssessmentAssignmentCreationAttributes
  extends Optional<AssessmentAssignmentAttributes, "assignment_id"> {}

class AssessmentAssignment
  extends Model<AssessmentAssignmentAttributes, AssessmentAssignmentCreationAttributes>
  implements AssessmentAssignmentAttributes
{
  public assignment_id!: bigint;
  public assessment_id!: bigint;
  public class_id!: number;
  public section_ids!: number[];
  public start_datetime!: Date;
  public end_datetime!: Date;
  public shuffle_questions?: boolean;
  public shuffle_options?: boolean;
  public show_result_immediately?: boolean;
  public assigned_by!: bigint;
}

AssessmentAssignment.init(
  {
    assignment_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    assessment_id: { type: DataTypes.BIGINT, allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    section_ids: {
      type: DataTypes.JSON,
      allowNull: false,
      comment: "Array of section_id integers",
    },
    start_datetime: { type: DataTypes.DATE, allowNull: false },
    end_datetime: { type: DataTypes.DATE, allowNull: false },
    shuffle_questions: { type: DataTypes.BOOLEAN, defaultValue: false },
    shuffle_options: { type: DataTypes.BOOLEAN, defaultValue: false },
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
  },
  {
    sequelize,
    tableName: "assessment_assignments",
    underscored: true,
    timestamps: true,
  }
);

export default AssessmentAssignment;
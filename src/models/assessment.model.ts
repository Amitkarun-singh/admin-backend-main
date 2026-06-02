import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type Difficulty = "easy" | "medium" | "hard";
type AssessmentStatus = "draft" | "published" | "archived";
type GeneratedBy = "AI" | "TEACHER";

interface AssessmentAttributes {
  assessment_id: bigint;
  school_id: bigint;
  created_by: bigint;
  title: string;
  subject_id: number;
  class_id: number;
  topic?: string | null;
  difficulty?: Difficulty;
  total_marks?: number;
  time_limit_minutes?: number | null;
  question_types_allowed?: string[];
  status?: AssessmentStatus;
  generated_by?: GeneratedBy;
}

interface AssessmentCreationAttributes
  extends Optional<AssessmentAttributes, "assessment_id"> {}

class Assessment
  extends Model<AssessmentAttributes, AssessmentCreationAttributes>
  implements AssessmentAttributes
{
  public assessment_id!: bigint;
  public school_id!: bigint;
  public created_by!: bigint;
  public title!: string;
  public subject_id!: number;
  public class_id!: number;
  public topic?: string | null;
  public difficulty?: Difficulty;
  public total_marks?: number;
  public time_limit_minutes?: number | null;
  public question_types_allowed?: string[];
  public status?: AssessmentStatus;
  public generated_by?: GeneratedBy;
}

Assessment.init(
  {
    assessment_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    school_id: { type: DataTypes.BIGINT, allowNull: false },
    created_by: {
      type: DataTypes.BIGINT,
      allowNull: false,
      comment: "teacher user_id",
    },
    title: { type: DataTypes.STRING, allowNull: false },
    subject_id: { type: DataTypes.INTEGER, allowNull: false },
    class_id: { type: DataTypes.INTEGER, allowNull: false },
    topic: { type: DataTypes.STRING, allowNull: true },
    difficulty: {
      type: DataTypes.ENUM("easy", "medium", "hard"),
      defaultValue: "medium",
    },
    total_marks: { type: DataTypes.INTEGER, defaultValue: 0 },
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
  },
  {
    sequelize,
    tableName: "assessments",
    underscored: true,
    timestamps: true,
  }
);

export default Assessment;
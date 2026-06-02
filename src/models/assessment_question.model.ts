import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type QuestionType = "mcq" | "true_false" | "short" | "essay";
type QuestionStatus = "pending" | "approved" | "rejected";

interface OptionItem {
  key: string;
  text: string;
}

interface AssessmentQuestionAttributes {
  question_id: bigint;
  assessment_id: bigint;
  question_text: string;
  question_type: QuestionType;
  options?: OptionItem[] | null;
  correct_answer?: string | null;
  hint?: string | null;
  marks?: number;
  status?: QuestionStatus;
  order?: number;
}

interface AssessmentQuestionCreationAttributes
  extends Optional<AssessmentQuestionAttributes, "question_id"> {}

class AssessmentQuestion
  extends Model<AssessmentQuestionAttributes, AssessmentQuestionCreationAttributes>
  implements AssessmentQuestionAttributes
{
  public question_id!: bigint;
  public assessment_id!: bigint;
  public question_text!: string;
  public question_type!: QuestionType;
  public options?: OptionItem[] | null;
  public correct_answer?: string | null;
  public hint?: string | null;
  public marks?: number;
  public status?: QuestionStatus;
  public order?: number;
}

AssessmentQuestion.init(
  {
    question_id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    assessment_id: { type: DataTypes.BIGINT, allowNull: false },
    question_text: { type: DataTypes.TEXT, allowNull: false },
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
    hint: { type: DataTypes.TEXT, allowNull: true },
    marks: { type: DataTypes.INTEGER, defaultValue: 1 },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      defaultValue: "pending",
      comment: "Teacher review status",
    },
    order: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: "assessment_questions",
    underscored: true,
    timestamps: true,
  }
);

export default AssessmentQuestion;
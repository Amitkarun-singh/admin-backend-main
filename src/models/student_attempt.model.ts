import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

/* ── StudentAttempt ────────────────────────────────────────── */

type AttemptStatus = "in_progress" | "submitted";

interface StudentAttemptAttributes {
  attempt_id: bigint;
  assignment_id: bigint;
  student_id: bigint;
  started_at?: Date;
  submitted_at?: Date | null;
  is_auto_submitted?: boolean;
  total_marks_obtained?: number | null;
  total_marks_possible?: number | null;
  status?: AttemptStatus;
}

interface StudentAttemptCreationAttributes
  extends Optional<StudentAttemptAttributes, "attempt_id"> {}

export class StudentAttempt
  extends Model<StudentAttemptAttributes, StudentAttemptCreationAttributes>
  implements StudentAttemptAttributes
{
  public attempt_id!: bigint;
  public assignment_id!: bigint;
  public student_id!: bigint;
  public started_at?: Date;
  public submitted_at?: Date | null;
  public is_auto_submitted?: boolean;
  public total_marks_obtained?: number | null;
  public total_marks_possible?: number | null;
  public status?: AttemptStatus;
}

StudentAttempt.init(
  {
    attempt_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    assignment_id: { type: DataTypes.BIGINT, allowNull: false },
    student_id: { type: DataTypes.BIGINT, allowNull: false },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    is_auto_submitted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "true if submitted on timer timeout",
    },
    total_marks_obtained: { type: DataTypes.DECIMAL(8, 2), allowNull: true },
    total_marks_possible: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM("in_progress", "submitted"),
      defaultValue: "in_progress",
    },
  },
  {
    sequelize,
    tableName: "student_attempts",
    underscored: true,
    timestamps: true,
  }
);

/* ── StudentAnswer ─────────────────────────────────────────── */

interface StudentAnswerAttributes {
  answer_id: bigint;
  attempt_id: bigint;
  question_id: bigint;
  answer_text?: string | null;
  is_correct?: boolean | null;
  marks_obtained?: number | null;
}

interface StudentAnswerCreationAttributes
  extends Optional<StudentAnswerAttributes, "answer_id"> {}

export class StudentAnswer
  extends Model<StudentAnswerAttributes, StudentAnswerCreationAttributes>
  implements StudentAnswerAttributes
{
  public answer_id!: bigint;
  public attempt_id!: bigint;
  public question_id!: bigint;
  public answer_text?: string | null;
  public is_correct?: boolean | null;
  public marks_obtained?: number | null;
}

StudentAnswer.init(
  {
    answer_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    attempt_id: { type: DataTypes.BIGINT, allowNull: false },
    question_id: { type: DataTypes.BIGINT, allowNull: false },
    answer_text: { type: DataTypes.TEXT, allowNull: true },
    is_correct: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      comment: "null for essay type (manual grading)",
    },
    marks_obtained: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  },
  {
    sequelize,
    tableName: "student_answers",
    underscored: true,
    timestamps: true,
  }
);
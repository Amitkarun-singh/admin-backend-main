import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface StudentAnalyticsAttributes {
  student_id: bigint;
  engagement_score?: number;
  learning_outcome?: number;
  ai_practice_score?: number;
}

class StudentAnalytics
  extends Model<StudentAnalyticsAttributes>
  implements StudentAnalyticsAttributes
{
  public student_id!: bigint;
  public engagement_score?: number;
  public learning_outcome?: number;
  public ai_practice_score?: number;
}

StudentAnalytics.init(
  {
    student_id: { type: DataTypes.BIGINT, primaryKey: true },
    engagement_score: { type: DataTypes.DECIMAL(5, 2) },
    learning_outcome: { type: DataTypes.DECIMAL(5, 2) },
    ai_practice_score: { type: DataTypes.DECIMAL(5, 2) },
  },
  {
    sequelize,
    tableName: "student_analytics",
    timestamps: false,
  }
);

export default StudentAnalytics;
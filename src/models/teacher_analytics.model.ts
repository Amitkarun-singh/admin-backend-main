import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface TeacherAnalyticsAttributes {
  teacher_id: bigint;
  ai_usage?: number;
  performance_score?: number;
  engagement_score?: number;
}

class TeacherAnalytics
  extends Model<TeacherAnalyticsAttributes>
  implements TeacherAnalyticsAttributes
{
  public teacher_id!: bigint;
  public ai_usage?: number;
  public performance_score?: number;
  public engagement_score?: number;
}

TeacherAnalytics.init(
  {
    teacher_id: { type: DataTypes.BIGINT, primaryKey: true },
    ai_usage: { type: DataTypes.DECIMAL(10, 2) },
    performance_score: { type: DataTypes.DECIMAL(5, 2) },
    engagement_score: { type: DataTypes.DECIMAL(5, 2) },
  },
  {
    sequelize,
    tableName: "teacher_analytics",
    timestamps: false,
  }
);

export default TeacherAnalytics;
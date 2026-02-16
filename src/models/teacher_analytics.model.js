import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("TeacherAnalytics", {
    teacher_id: { type: DataTypes.BIGINT, primaryKey: true },
    ai_usage: DataTypes.DECIMAL(10,2),
    performance_score: DataTypes.DECIMAL(5,2),
    engagement_score: DataTypes.DECIMAL(5,2)
},{
    tableName: "teacher_analytics",
    timestamps: false
});

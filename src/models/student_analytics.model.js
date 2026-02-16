import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("StudentAnalytics", {
    student_id: { type: DataTypes.BIGINT, primaryKey: true },
    engagement_score: DataTypes.DECIMAL(5,2),
    learning_outcome: DataTypes.DECIMAL(5,2),
    ai_practice_score: DataTypes.DECIMAL(5,2)
},{
    tableName: "student_analytics",
    timestamps: false
});

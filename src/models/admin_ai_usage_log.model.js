import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminAiUsageLog", {
    log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: DataTypes.BIGINT,
    feature_name: DataTypes.STRING,
    tokens_used: DataTypes.INTEGER,
    cost: DataTypes.DECIMAL(10,2)
},{
    tableName: "admin_ai_usage_logs",
    timestamps: false
});

import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminAuditLog", {
    log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    admin_user_id: DataTypes.BIGINT,
    target_user_id: DataTypes.BIGINT,
    action: DataTypes.STRING
},{
    tableName: "admin_audit_logs",
    timestamps: false
});

import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminAuditLogAttributes {
  log_id: bigint;
  admin_user_id?: bigint;
  target_user_id?: bigint;
  action?: string;
}

interface AdminAuditLogCreationAttributes
  extends Optional<AdminAuditLogAttributes, "log_id"> {}

class AdminAuditLog
  extends Model<AdminAuditLogAttributes, AdminAuditLogCreationAttributes>
  implements AdminAuditLogAttributes
{
  public log_id!: bigint;
  public admin_user_id?: bigint;
  public target_user_id?: bigint;
  public action?: string;
}

AdminAuditLog.init(
  {
    log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    admin_user_id: { type: DataTypes.BIGINT },
    target_user_id: { type: DataTypes.BIGINT },
    action: { type: DataTypes.STRING },
  },
  {
    sequelize,
    tableName: "admin_audit_logs",
    timestamps: false,
  }
);

export default AdminAuditLog;
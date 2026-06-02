import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminAiUsageLogAttributes {
  log_id: bigint;
  user_id?: bigint;
  feature_name?: string;
  tokens_used?: number;
  cost?: number;
}

interface AdminAiUsageLogCreationAttributes
  extends Optional<AdminAiUsageLogAttributes, "log_id"> {}

class AdminAiUsageLog
  extends Model<AdminAiUsageLogAttributes, AdminAiUsageLogCreationAttributes>
  implements AdminAiUsageLogAttributes
{
  public log_id!: bigint;
  public user_id?: bigint;
  public feature_name?: string;
  public tokens_used?: number;
  public cost?: number;
}

AdminAiUsageLog.init(
  {
    log_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT },
    feature_name: { type: DataTypes.STRING },
    tokens_used: { type: DataTypes.INTEGER },
    cost: { type: DataTypes.DECIMAL(10, 2) },
  },
  {
    sequelize,
    tableName: "admin_ai_usage_logs",
    timestamps: false,
  }
);

export default AdminAiUsageLog;
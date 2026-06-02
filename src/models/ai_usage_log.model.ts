import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type AiFeature = "summarizer" | "ai_notes";

interface AiUsageLogAttributes {
  id: bigint;
  user_id?: bigint;
  feature?: AiFeature;
  action?: string;
  endpoint?: string;
  request_payload?: object;
  response_data?: object;
  response_status?: number;
  response_time_ms?: number;
  ip_address?: string;
}

interface AiUsageLogCreationAttributes
  extends Optional<AiUsageLogAttributes, "id"> {}

class AiUsageLog
  extends Model<AiUsageLogAttributes, AiUsageLogCreationAttributes>
  implements AiUsageLogAttributes
{
  public id!: bigint;
  public user_id?: bigint;
  public feature?: AiFeature;
  public action?: string;
  public endpoint?: string;
  public request_payload?: object;
  public response_data?: object;
  public response_status?: number;
  public response_time_ms?: number;
  public ip_address?: string;
}

AiUsageLog.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: { type: DataTypes.BIGINT },
    feature: { type: DataTypes.ENUM("summarizer", "ai_notes") },
    action: { type: DataTypes.STRING },
    endpoint: { type: DataTypes.STRING },
    request_payload: { type: DataTypes.JSON },
    response_data: { type: DataTypes.JSON },
    response_status: { type: DataTypes.INTEGER },
    response_time_ms: { type: DataTypes.INTEGER },
    ip_address: { type: DataTypes.STRING },
  },
  {
    sequelize,
    tableName: "ai_usage_logs",
    underscored: true,
    timestamps: true,
  }
);

export default AiUsageLog;
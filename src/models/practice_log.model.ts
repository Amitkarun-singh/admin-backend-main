import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface PracticeLogAttributes {
  id: number;
  conversation_id: string;
  user_id: number;
  method: string;
  url: string;
  status_code: number;
  device?: string | null;
  request_body?: string | null;
  response_body?: string | null;
  user_details?: string | null;
  created_at: Date;
}

interface PracticeLogCreationAttributes
  extends Optional<PracticeLogAttributes, "id"> {}

class PracticeLog
  extends Model<PracticeLogAttributes, PracticeLogCreationAttributes>
  implements PracticeLogAttributes
{
  public id!: number;
  public conversation_id!: string;
  public user_id!: number;
  public method!: string;
  public url!: string;
  public status_code!: number;
  public device?: string | null;
  public request_body?: string | null;
  public response_body?: string | null;
  public user_details?: string | null;
  public created_at!: Date;
}

PracticeLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversation_id: { type: DataTypes.STRING(36), allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    method: { type: DataTypes.STRING(10), allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    status_code: { type: DataTypes.INTEGER, allowNull: false },
    device: { type: DataTypes.TEXT, allowNull: true },
    request_body: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get(): unknown {
        const raw = this.getDataValue("request_body");
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return raw;
        }
      },
    },
    response_body: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get(): unknown {
        const raw = this.getDataValue("response_body");
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return raw;
        }
      },
    },
    user_details: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get(): unknown {
        const raw = this.getDataValue("user_details");
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return raw;
        }
      },
    },
    created_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    sequelize,
    tableName: "practice_questions_logs",
    timestamps: false,
  }
);

export default PracticeLog;
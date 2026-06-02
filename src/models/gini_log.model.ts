import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface GiniLogAttributes {
  id: number;
  conversation_id?: string | null;
  user_id: number;
  method?: string | null;
  url?: string | null;
  status_code?: number | null;
  device?: string | null;
  messages?: string | null;
  language?: string | null;
  class?: string | null;
  subject?: string | null;
  file_name?: string | null;
  response_body?: string | null;
  created_at?: Date | null;
}

interface GiniLogCreationAttributes
  extends Optional<GiniLogAttributes, "id"> {}

class GiniLog
  extends Model<GiniLogAttributes, GiniLogCreationAttributes>
  implements GiniLogAttributes
{
  public id!: number;
  public conversation_id?: string | null;
  public user_id!: number;
  public method?: string | null;
  public url?: string | null;
  public status_code?: number | null;
  public device?: string | null;
  public messages?: string | null;
  public language?: string | null;
  public class?: string | null;
  public subject?: string | null;
  public file_name?: string | null;
  public response_body?: string | null;
  public created_at?: Date | null;
}

GiniLog.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    conversation_id: { type: DataTypes.STRING(100), allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    method: { type: DataTypes.STRING(10), allowNull: true },
    url: { type: DataTypes.STRING(255), allowNull: true },
    status_code: { type: DataTypes.INTEGER, allowNull: true },
    device: { type: DataTypes.TEXT, allowNull: true },
    messages: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
      get(): unknown {
        const raw = this.getDataValue("messages");
        try {
          return raw ? JSON.parse(raw) : null;
        } catch {
          return raw;
        }
      },
    },
    language: { type: DataTypes.STRING(20), allowNull: true },
    class: { type: DataTypes.STRING(20), allowNull: true },
    subject: { type: DataTypes.STRING(100), allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: true },
    response_body: { type: DataTypes.TEXT("long"), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "chatbot_logs",
    timestamps: false,
  }
);

export default GiniLog;
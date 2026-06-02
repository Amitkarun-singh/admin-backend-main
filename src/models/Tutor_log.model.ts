import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface TutorLogAttributes {
  id: bigint;
  conversation_id: string;
  user_id: bigint;
  method: string;
  url: string;
  status_code?: number | null;
  device?: string | null;
  request_body?: string | null;
  response_body?: string | null;
  user_details?: string | null;
  session_id?: string | null;
  created_at?: Date | null;
}

interface TutorLogCreationAttributes
  extends Optional<TutorLogAttributes, "id"> {}

class TutorLog
  extends Model<TutorLogAttributes, TutorLogCreationAttributes>
  implements TutorLogAttributes
{
  public id!: bigint;
  public conversation_id!: string;
  public user_id!: bigint;
  public method!: string;
  public url!: string;
  public status_code?: number | null;
  public device?: string | null;
  public request_body?: string | null;
  public response_body?: string | null;
  public user_details?: string | null;
  public session_id?: string | null;
  public created_at?: Date | null;
}

TutorLog.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    conversation_id: { type: DataTypes.STRING(255), allowNull: false },
    user_id: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
    method: { type: DataTypes.STRING(10), allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    status_code: { type: DataTypes.INTEGER, allowNull: true },
    device: { type: DataTypes.STRING(100), allowNull: true },
    request_body: { type: DataTypes.TEXT("long"), allowNull: true },
    response_body: { type: DataTypes.TEXT("long"), allowNull: true },
    user_details: { type: DataTypes.TEXT("long"), allowNull: true },
    session_id: { type: DataTypes.STRING(255), allowNull: true },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: "tutor_logs",
    timestamps: false,
    underscored: true,
  }
);

export default TutorLog;
import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface UserSessionAttributes {
  session_id: bigint;
  user_id: bigint;
  login_at?: Date;
  logout_at?: Date | null;
  device?: string | null;
  ip_address?: string | null;
  city?: string | null;
  country?: string | null;
}

interface UserSessionCreationAttributes
  extends Optional<UserSessionAttributes, "session_id"> {}

class UserSession
  extends Model<UserSessionAttributes, UserSessionCreationAttributes>
  implements UserSessionAttributes
{
  public session_id!: bigint;
  public user_id!: bigint;
  public login_at?: Date;
  public logout_at?: Date | null;
  public device?: string | null;
  public ip_address?: string | null;
  public city?: string | null;
  public country?: string | null;
}

UserSession.init(
  {
    session_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    login_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    logout_at: { type: DataTypes.DATE, allowNull: true },
    device: { type: DataTypes.STRING(50), allowNull: true },
    ip_address: { type: DataTypes.STRING(50), allowNull: true },
    city: { type: DataTypes.STRING(100), allowNull: true },
    country: { type: DataTypes.STRING(100), allowNull: true },
  },
  {
    sequelize,
    tableName: "user_sessions",
    underscored: true,
    timestamps: false,
  }
);

export default UserSession;
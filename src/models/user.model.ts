import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

export default class User extends Model {
  declare user_id: number;
  declare school_id: number;
  declare role_id: number;
  declare username: string;
  declare full_name: string;
  declare password: string;
  declare phone_number: string;
  declare email: string;
  declare status: string;
  declare avatar: string;
  declare is_password_reset_required: boolean;
  declare self_register: boolean;
  declare token : string
}

User.init(
  {
    user_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    school_id: { type: DataTypes.BIGINT, allowNull: true },

    role_id: { type: DataTypes.INTEGER },

    username: { type: DataTypes.STRING, unique: true },

    full_name: { type: DataTypes.STRING },

    password: { type: DataTypes.STRING },

    phone_number: { type: DataTypes.STRING, unique: true },

    email: { type: DataTypes.STRING, unique: true },

    status: { type: DataTypes.ENUM("Active", "Suspended", "Blocked") },

    avatar: { type: DataTypes.STRING },

    token: { type: DataTypes.STRING },

    is_password_reset_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    self_register: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }
  },
  {
    sequelize,
    tableName: "users",
    underscored: true,
    timestamps: true,
  },
);
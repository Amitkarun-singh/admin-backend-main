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
  declare address: string;
  declare status: string;
  declare avatar: string;
  declare is_password_reset_required: boolean;
  declare self_register: boolean;
  declare token: string;
}

User.init(
  {
    user_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },

    school_id: { type: DataTypes.BIGINT, allowNull: true },

    role_id: { type: DataTypes.INTEGER },

    /** Auto-generated unique login handle — never entered by the user */
    username: { type: DataTypes.STRING, allowNull: false, unique: true },

    full_name: { type: DataTypes.STRING, allowNull: true },

    password: { type: DataTypes.STRING, allowNull: false },

    /** Multiple accounts can share a phone number (e.g. parent + child) */
    phone_number: { type: DataTypes.STRING, allowNull: true, unique: false },

    /** Optional — unique only when provided (NULL is not considered a duplicate) */
    email: { type: DataTypes.STRING, allowNull: true, unique: true },

    /** Optional home / shipping address */
    address: { type: DataTypes.TEXT, allowNull: true },

    status: { type: DataTypes.ENUM("Active", "Suspended", "Blocked"), allowNull: true },

    avatar: { type: DataTypes.STRING, allowNull: true },

    token: { type: DataTypes.STRING, allowNull: true },

    is_password_reset_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    self_register: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: "users",
    underscored: true,
    timestamps: true,
  },
);
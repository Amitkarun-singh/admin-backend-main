import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

export default class User extends Model { }

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

    // ✅ NEW: forces password reset on first login
    // Set to true when admin creates student / teacher / parent
    // Flipped to false after the user sets their own password
    is_password_reset_required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    self_register:{
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
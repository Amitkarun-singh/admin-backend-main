import { DataTypes } from "sequelize";

import sequelize from "../config/db.js";

export default sequelize.define(
  "User",
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
  },
  {
    tableName: "users",

    underscored: true,

    timestamps: true,
  },
);

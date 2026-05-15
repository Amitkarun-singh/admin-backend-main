import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

/**
 * user_streaks table
 * One row per user. Tracks daily login activity.
 *
 * last_active_date  – IST date (YYYY-MM-DD) of the most recent login.
 * current_streak    – consecutive days logged in up to today.
 * longest_streak    – all-time best streak.
 */
export default class UserStreak extends Model {}

UserStreak.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,          // one row per user
    },

    last_active_date: {
      type: DataTypes.DATEONLY,   // stores 'YYYY-MM-DD', no time
      allowNull: true,
      defaultValue: null,
    },

    current_streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    longest_streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: "user_streaks",
    underscored: true,
    timestamps: true,
  }
);
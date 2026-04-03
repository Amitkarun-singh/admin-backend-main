import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const UserSession = sequelize.define("UserSession", {
  session_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  login_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  logout_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  // device string from User-Agent e.g. "Desktop", "Mobile", "Tablet"
  device: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  // IP address at login time
  ip_address: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  // Resolved city from IP (can be populated later or via middleware)
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: "user_sessions",
  underscored: true,
  timestamps: false,
});

export default UserSession;
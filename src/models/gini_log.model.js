import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const GiniLog = sequelize.define("GiniLog", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversation_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: true,
  },
  url: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  device: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  messages: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
    get() {
      const raw = this.getDataValue("messages");
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    },
  },
  language: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  class: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  subject: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  response_body: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: "chatbot_logs",   // ← real table name
  timestamps: false,
});

export default GiniLog;
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PracticeLog = sequelize.define("PracticeLog", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversation_id: {
    type: DataTypes.STRING(36),
    allowNull: false,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  method: {
    type: DataTypes.STRING(10),
    allowNull: false,
  },
  url: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  status_code: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  device: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  request_body: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
    get() {
      const raw = this.getDataValue("request_body");
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    },
  },
  response_body: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
    get() {
      const raw = this.getDataValue("response_body");
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    },
  },
  user_details: {
    type: DataTypes.TEXT("long"),
    allowNull: true,
    get() {
      const raw = this.getDataValue("user_details");
      try { return raw ? JSON.parse(raw) : null; } catch { return raw; }
    },
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: "practice_questions_logs",  // ← real table name
  timestamps: false,
});

export default PracticeLog;
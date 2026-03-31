import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AdminClassSubject = sequelize.define("AdminClassSubject", {
  class_subject_id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true
  },
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "admin_classes",
      key: "class_id"
    }
  },
  subject_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: "admin_subjects_master",
      key: "subject_id"
    }
  },
  language: {
    type: DataTypes.STRING,
    allowNull: false
  },
  ai_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM("active","inactive"),
    defaultValue: "active"
  }
},{
  tableName: "admin_class_subjects",
  timestamps: false
});

export default AdminClassSubject;
import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AdminClassCourseMap = sequelize.define("AdminClassCourseMap", {
  class_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "admin_classes",
      key: "class_id"
    }
  },
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "admin_sections",
      key: "section_id"
    }
  },
  course_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "admin_courses",
      key: "course_id"
    }
  }
},{
  tableName: "admin_class_course_map",
  timestamps: false
});

export default AdminClassCourseMap;
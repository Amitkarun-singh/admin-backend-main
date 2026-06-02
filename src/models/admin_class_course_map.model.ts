import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface AdminClassCourseMapAttributes {
  class_id: number;
  section_id: number;
  course_id: bigint;
}

class AdminClassCourseMap
  extends Model<AdminClassCourseMapAttributes>
  implements AdminClassCourseMapAttributes
{
  public class_id!: number;
  public section_id!: number;
  public course_id!: bigint;
}

AdminClassCourseMap.init(
  {
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: "admin_classes", key: "class_id" },
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: "admin_sections", key: "section_id" },
    },
    course_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      primaryKey: true,
      references: { model: "admin_courses", key: "course_id" },
    },
  },
  {
    sequelize,
    tableName: "admin_class_course_map",
    timestamps: false,
  }
);

export default AdminClassCourseMap;
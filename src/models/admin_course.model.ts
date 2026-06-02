import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type CourseType = "SCHOOL" | "JEE" | "NEET" | "UPSC" | "AI" | "OTHER";
type StatusType = "active" | "inactive";

interface AdminCourseAttributes {
  course_id: bigint;
  school_id?: bigint;
  course_name?: string;
  course_type?: CourseType;
  language?: string;
  ai_features?: object;
  status?: StatusType;
}

interface AdminCourseCreationAttributes
  extends Optional<AdminCourseAttributes, "course_id"> {}

class AdminCourse
  extends Model<AdminCourseAttributes, AdminCourseCreationAttributes>
  implements AdminCourseAttributes
{
  public course_id!: bigint;
  public school_id?: bigint;
  public course_name?: string;
  public course_type?: CourseType;
  public language?: string;
  public ai_features?: object;
  public status?: StatusType;
}

AdminCourse.init(
  {
    course_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.BIGINT },
    course_name: { type: DataTypes.STRING },
    course_type: { type: DataTypes.ENUM("SCHOOL", "JEE", "NEET", "UPSC", "AI", "OTHER") },
    language: { type: DataTypes.STRING },
    ai_features: { type: DataTypes.JSON },
    status: { type: DataTypes.ENUM("active", "inactive") },
  },
  {
    sequelize,
    tableName: "admin_courses",
    timestamps: false,
  }
);

export default AdminCourse;
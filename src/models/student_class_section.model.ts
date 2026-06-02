import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

type SectionStatus = "active" | "inactive";

interface StudentClassSectionAttributes {
  student_id: bigint;
  class_id?: number;
  section_id?: number;
  academic_year?: string;
  roll_number?: string;
  status?: SectionStatus;
}

class StudentClassSection
  extends Model<StudentClassSectionAttributes>
  implements StudentClassSectionAttributes
{
  public student_id!: bigint;
  public class_id?: number;
  public section_id?: number;
  public academic_year?: string;
  public roll_number?: string;
  public status?: SectionStatus;
}

StudentClassSection.init(
  {
    student_id: { type: DataTypes.BIGINT, primaryKey: true },
    class_id: { type: DataTypes.INTEGER },
    section_id: { type: DataTypes.INTEGER },
    academic_year: { type: DataTypes.STRING },
    roll_number: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM("active", "inactive") },
  },
  {
    sequelize,
    tableName: "student_class_section",
    timestamps: false,
  }
);

export default StudentClassSection;
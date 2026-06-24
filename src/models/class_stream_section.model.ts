import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface ClassStreamSectionAttributes {
  id?: number;
  school_id: number;
  class_id: number;
  stream_id: number;
  section_id: number;
  slug: string;
}

class ClassStreamSection
  extends Model<ClassStreamSectionAttributes>
  implements ClassStreamSectionAttributes
{
  public id!: number;
  public school_id!: number;
  public class_id!: number;
  public stream_id!: number;
  public section_id!: number;
  public slug!: string;
}

ClassStreamSection.init(
  {
    id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id:  { type: DataTypes.INTEGER, allowNull: false },
    class_id:   { type: DataTypes.INTEGER, allowNull: false },
    stream_id:  { type: DataTypes.INTEGER, allowNull: false },
    section_id: { type: DataTypes.INTEGER, allowNull: false },
    /**
     * Deterministic slug — built as "c{classId}-st{streamId}-se{sectionId}-sc{schoolId}"
     * e.g. "c5-st4-se2-sc12"
     * Used as unique key to prevent duplicate rows.
     */
    slug:       { type: DataTypes.STRING(100), allowNull: false, unique: true },
  },
  {
    sequelize,
    tableName: "class_stream_sections",
    underscored: true,
    timestamps: false,
  }
);

export default ClassStreamSection;
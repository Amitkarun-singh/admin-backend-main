import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminChapterMasterAttributes {
  chapter_id: number;
  board_name: string;
  class_id: number;
  language: string;
  subject_id: number;
  chapter_name: string;
  chapter_order?: number;
  status?: "active" | "inactive";
}

interface AdminChapterMasterCreationAttributes
  extends Optional<AdminChapterMasterAttributes, "chapter_id"> {}

class AdminChapterMaster
  extends Model<AdminChapterMasterAttributes, AdminChapterMasterCreationAttributes>
  implements AdminChapterMasterAttributes
{
  public chapter_id!: number;
  public board_name!: string;
  public class_id!: number;
  public language!: string;
  public subject_id!: number;
  public chapter_name!: string;
  public chapter_order?: number;
  public status?: "active" | "inactive";
}

AdminChapterMaster.init(
  {
    chapter_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    board_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "admin_classes", key: "class_id" },
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "admin_subjects", key: "subject_id" },
    },
    chapter_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    chapter_order: {
      type: DataTypes.INTEGER,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      defaultValue: "active",
    },
  },
  {
    sequelize,
    tableName: "admin_chapters_master",
    timestamps: false,
  }
);

export default AdminChapterMaster;
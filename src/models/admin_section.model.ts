import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminSectionAttributes {
  section_id: number;
  class_id: number;
  section_name: string;
  school_id: bigint;
}

interface AdminSectionCreationAttributes
  extends Optional<AdminSectionAttributes, "section_id"> {}

class AdminSection
  extends Model<AdminSectionAttributes, AdminSectionCreationAttributes>
  implements AdminSectionAttributes
{
  public section_id!: number;
  public class_id!: number;
  public section_name!: string;
  public school_id!: bigint;
}

AdminSection.init(
  {
    section_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "admin_classes", key: "class_id" },
    },
    section_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    school_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      references: { model: "admin_schools", key: "school_id" },
    },
  },
  {
    sequelize,
    tableName: "admin_sections",
    timestamps: false,
  }
);

export default AdminSection;
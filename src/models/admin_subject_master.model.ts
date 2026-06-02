import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminSubjectAttributes {
  subject_id: number;
  class_id: number;
  board: string;
  language: string;
  subject_name: string;
}

interface AdminSubjectCreationAttributes
  extends Optional<AdminSubjectAttributes, "subject_id"> {}

class AdminSubject
  extends Model<AdminSubjectAttributes, AdminSubjectCreationAttributes>
  implements AdminSubjectAttributes
{
  public subject_id!: number;
  public class_id!: number;
  public board!: string;
  public language!: string;
  public subject_name!: string;
}

AdminSubject.init(
  {
    subject_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    class_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    board: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    language: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    subject_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "admin_subjects",
    timestamps: false,
  }
);

export default AdminSubject;
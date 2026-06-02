import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface ParentStudentMapAttributes {
  parent_id?: bigint;
  student_id?: bigint;
}

class ParentStudentMap
  extends Model<ParentStudentMapAttributes>
  implements ParentStudentMapAttributes
{
  public parent_id?: bigint;
  public student_id?: bigint;
}

ParentStudentMap.init(
  {
    parent_id: { type: DataTypes.BIGINT },
    student_id: { type: DataTypes.BIGINT },
  },
  {
    sequelize,
    tableName: "parent_student_map",
    timestamps: false,
  }
);

export default ParentStudentMap;
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface UserClassAttributes {
  user_id: number;
  class_stream_section_id: number;
}

class UserClass extends Model<UserClassAttributes> implements UserClassAttributes {
  public user_id!: number;
  public class_stream_section_id!: number;
}

UserClass.init(
  {
    user_id:                 { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
    class_stream_section_id: { type: DataTypes.INTEGER, allowNull: false, primaryKey: true },
  },
  {
    sequelize,
    tableName: "user_classes",
    underscored: true,
    timestamps: false,
  }
);

export default UserClass;
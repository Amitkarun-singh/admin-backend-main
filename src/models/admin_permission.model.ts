import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminPermissionAttributes {
  permission_id: number;
  permission_key?: string;
  description?: string;
}

interface AdminPermissionCreationAttributes
  extends Optional<AdminPermissionAttributes, "permission_id"> {}

class AdminPermission
  extends Model<AdminPermissionAttributes, AdminPermissionCreationAttributes>
  implements AdminPermissionAttributes
{
  public permission_id!: number;
  public permission_key?: string;
  public description?: string;
}

AdminPermission.init(
  {
    permission_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    permission_key: { type: DataTypes.STRING },
    description: { type: DataTypes.STRING },
  },
  {
    sequelize,
    tableName: "admin_permissions",
    timestamps: false,
  }
);

export default AdminPermission;
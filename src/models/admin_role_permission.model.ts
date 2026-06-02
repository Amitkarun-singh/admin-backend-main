import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminRolePermissionAttributes {
  id: number;
  role_id?: number;
  permission_id?: number;
}

interface AdminRolePermissionCreationAttributes
  extends Optional<AdminRolePermissionAttributes, "id"> {}

class AdminRolePermission
  extends Model<AdminRolePermissionAttributes, AdminRolePermissionCreationAttributes>
  implements AdminRolePermissionAttributes
{
  public id!: number;
  public role_id?: number;
  public permission_id?: number;
}

AdminRolePermission.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role_id: { type: DataTypes.INTEGER },
    permission_id: { type: DataTypes.INTEGER },
  },
  {
    sequelize,
    tableName: "admin_role_permissions",
    timestamps: false,
  }
);

export default AdminRolePermission;
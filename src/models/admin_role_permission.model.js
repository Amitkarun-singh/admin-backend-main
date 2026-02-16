import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminRolePermission", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role_id: DataTypes.INTEGER,
    permission_id: DataTypes.INTEGER
},{
    tableName: "admin_role_permissions",
    timestamps: false
});

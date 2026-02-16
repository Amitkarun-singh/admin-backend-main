import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminPermission", {
    permission_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    permission_key: DataTypes.STRING,
    description: DataTypes.STRING
},{
    tableName: "admin_permissions",
    timestamps: false
});

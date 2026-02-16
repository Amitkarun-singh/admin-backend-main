import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminRole", {
    role_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role_name: DataTypes.STRING,
    description: DataTypes.STRING
},{
    tableName: "admin_roles",
    timestamps: false
});

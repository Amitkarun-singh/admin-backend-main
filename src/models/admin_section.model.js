import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminSection", {
    section_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    class_id: DataTypes.INTEGER,
    section_name: DataTypes.STRING
},{
    tableName: "admin_sections",
    timestamps: false
});

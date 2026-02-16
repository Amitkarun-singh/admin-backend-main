import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminClass", {
    class_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: DataTypes.BIGINT,
    class_name: DataTypes.STRING
},{
    tableName: "admin_classes",
    timestamps: false
});

import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AdminSection = sequelize.define("AdminSection", {
    section_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: "admin_classes",
            key: "class_id"
        }
    },
    section_name: {
        type: DataTypes.STRING,
        allowNull: false
    }
},{
    tableName: "admin_sections",
    timestamps: false
});

export default AdminSection;
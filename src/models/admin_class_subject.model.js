import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminClassSubject", {
    class_subject_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    class_id: DataTypes.INTEGER,
    section_id: DataTypes.INTEGER,
    subject_id: DataTypes.INTEGER,
    language: DataTypes.STRING,
    ai_enabled: DataTypes.BOOLEAN,
    status: DataTypes.ENUM("active","inactive")
},{
    tableName: "admin_class_subjects",
    timestamps: false
});

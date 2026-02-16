import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("StudentClassSection", {
    student_id: { type: DataTypes.BIGINT, primaryKey: true },
    class_id: DataTypes.INTEGER,
    section_id: DataTypes.INTEGER,
    academic_year: DataTypes.STRING,
    roll_number: DataTypes.STRING,
    status: DataTypes.ENUM("active","inactive")
},{
    tableName: "student_class_section",
    timestamps: false
});

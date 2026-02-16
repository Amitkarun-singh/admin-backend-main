import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminClassCourseMap", {
    class_id: DataTypes.INTEGER,
    section_id: DataTypes.INTEGER,
    course_id: DataTypes.BIGINT
},{
    tableName: "admin_class_course_map",
    timestamps: false
});

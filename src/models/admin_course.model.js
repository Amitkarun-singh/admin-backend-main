import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminCourse", {
    course_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    school_id: DataTypes.BIGINT,
    course_name: DataTypes.STRING,
    course_type: DataTypes.ENUM("SCHOOL","JEE","NEET","UPSC","AI","OTHER"),
    language: DataTypes.STRING,
    ai_features: DataTypes.JSON,
    status: DataTypes.ENUM("active","inactive")
},{
    tableName: "admin_courses",
    timestamps: false
});

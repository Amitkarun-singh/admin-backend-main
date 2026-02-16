import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("ParentStudentMap", {
    parent_id: DataTypes.BIGINT,
    student_id: DataTypes.BIGINT
},{
    tableName: "parent_student_map",
    timestamps: false
});

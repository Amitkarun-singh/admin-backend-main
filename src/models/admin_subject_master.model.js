import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminSubjectMaster", {
    subject_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subject_name: DataTypes.STRING
},{
    tableName: "admin_subjects_master",
    timestamps: false
});

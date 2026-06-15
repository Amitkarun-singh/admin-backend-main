import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

export default class TeacherClassSectionSubject extends Model {
    declare teacher_id: number;
    declare class_id: number;
    declare section_id: number;
    declare stream_id?: number; 
    declare class_subject_id: number;
    declare academic_year: string;
    declare id: number;
}

TeacherClassSectionSubject.init({
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    teacher_id: DataTypes.BIGINT,
    class_id: DataTypes.INTEGER,
    section_id: DataTypes.INTEGER,
    stream_id: DataTypes.INTEGER,
    class_subject_id: DataTypes.INTEGER,
    academic_year: DataTypes.STRING,


}, {
    sequelize,
    tableName: "teacher_class_section_subject",
    timestamps: false
});

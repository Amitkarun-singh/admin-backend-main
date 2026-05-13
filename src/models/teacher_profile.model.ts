import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class TeacherProfile extends Model {
    declare teacher_id: number;
    declare user_id: number;
    declare school_id: number;
    declare primary_subject_id: number;
    declare secondary_subject_ids: string[];
    declare experience: number;
    declare age: number;
    declare onboarding_date: Date;
    declare school_tenure: number;
    declare device_type: string;
    declare device_access: Record<string, boolean>;
    declare ppt_generation_enabled: boolean;
    declare cost_limit: number;
}

TeacherProfile.init(
    {
    teacher_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: DataTypes.BIGINT,
    school_id: DataTypes.BIGINT,
    primary_subject_id: DataTypes.INTEGER,
    secondary_subject_ids: DataTypes.JSON,
    experience: DataTypes.INTEGER,
    age: DataTypes.INTEGER,
    onboarding_date: DataTypes.DATE,
    school_tenure: DataTypes.INTEGER,
    device_type: DataTypes.STRING,
    device_access: DataTypes.JSON,
    ppt_generation_enabled: DataTypes.BOOLEAN,
    cost_limit: DataTypes.DECIMAL(10,2)
    },
    {
    sequelize,
    tableName: "teacher_profiles",
    underscored: true,
    timestamps: true
    });

export default TeacherProfile;

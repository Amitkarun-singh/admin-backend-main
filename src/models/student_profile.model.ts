import { DataTypes , Model} from "sequelize";
import sequelize from "../config/db.js";

export default class StudentProfile extends Model {
    declare student_id: number;
    declare user_id: number;
    declare school_id: number;
    declare preferred_language: string;
    declare onboarding_date: Date;
    declare cost_limit: number;
    declare dob: Date;
    declare gender: string;
    declare analytics_enabled: boolean;
}   

StudentProfile.init(
    {
    student_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: DataTypes.BIGINT,
    school_id: DataTypes.BIGINT,
    preferred_language: DataTypes.STRING,
    onboarding_date: DataTypes.DATE,
    cost_limit: DataTypes.DECIMAL(10,2),
    dob: DataTypes.DATE,
    gender: DataTypes.ENUM("male","female","other"),
    analytics_enabled: DataTypes.BOOLEAN,
},{
    sequelize,
    tableName: "student_profiles",
    underscored: true,
    timestamps: true
});

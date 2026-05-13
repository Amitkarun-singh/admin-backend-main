import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

class AdminSchool extends Model {
    declare school_id: number;
    declare school_name: string;
    declare country: string;
    declare state: string;
    declare city: string;
    declare pincode: string;
    declare timezone: string;
    declare board: string;
    declare language_preference: string;
    declare cost: number;
    declare student_count: number;
    declare teacher_count: number;
    declare class_count: number;
    declare onboard_date: Date;
    declare status: string;
    declare website_enabled: boolean;
    declare allowed_domains: string;
 }

AdminSchool.init(
    {
    school_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field:"id"  },
    school_name: DataTypes.STRING,
    country: DataTypes.STRING,
    state: DataTypes.STRING,
    city: DataTypes.STRING,
    pincode: DataTypes.STRING,
    timezone: DataTypes.STRING,
    board: DataTypes.STRING,
    language_preference: DataTypes.STRING,
    cost: DataTypes.DECIMAL(10,2),
    student_count: DataTypes.INTEGER,
    teacher_count: DataTypes.INTEGER,
    class_count: DataTypes.INTEGER,
    onboard_date: DataTypes.DATE,
    status: DataTypes.ENUM("Active","Suspended","Trial","Archived"),
    website_enabled: DataTypes.BOOLEAN,
    allowed_domains: DataTypes.TEXT
},{
    sequelize,
    tableName: "schools",
    timestamps: false
});


export default AdminSchool;
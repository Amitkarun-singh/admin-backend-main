import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminUser", {
    user_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    school_id: DataTypes.BIGINT,
    role_id: DataTypes.INTEGER,
    username: DataTypes.STRING,
    password: DataTypes.STRING,
    phone_number: DataTypes.STRING,
    email: DataTypes.STRING,
    status: DataTypes.ENUM("active","suspended","blocked")
},{
    tableName: "admin_users",
    underscored: true,
    timestamps: true
});

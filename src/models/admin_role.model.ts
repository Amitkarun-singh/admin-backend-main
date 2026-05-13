import { DataTypes , Model} from "sequelize";
import sequelize from "../config/db.js";

export default class AdminRole extends Model {
    declare role_id: number;
    declare role_name: string;
    declare description: string;
}

AdminRole.init(
    {
    role_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    role_name: DataTypes.STRING,
    description: DataTypes.STRING
},{
    sequelize,
    tableName: "admin_roles",
    timestamps: false
});

import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AdminClassAttributes {
    class_id: number;
    class_name?: string;
}

interface AdminClassCreationAttributes
    extends Optional<AdminClassAttributes, "class_id"> {}

class AdminClass
    extends Model<AdminClassAttributes, AdminClassCreationAttributes>
    implements AdminClassAttributes
{
    public class_id!: number;
    public class_name?: string;
}

AdminClass.init(
    {
        class_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        class_name: { type: DataTypes.STRING },
    },
    {
        sequelize,
        tableName: "admin_classes",
        timestamps: false,
    }
);

export default AdminClass;
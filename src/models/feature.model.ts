import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface FeatureAttributes {
  id: number;
  feature_name: string;
  description?: string | null;
  is_ai?: boolean;
  created_at?: Date;
}

interface FeatureCreationAttributes
  extends Optional<FeatureAttributes, "id"> {}

class Feature
  extends Model<FeatureAttributes, FeatureCreationAttributes>
  implements FeatureAttributes
{
  public id!: number;
  public feature_name!: string;
  public description?: string | null;
  public is_ai?: boolean;
  public created_at?: Date;
}

Feature.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    feature_name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_ai: { type: DataTypes.BOOLEAN, defaultValue: false },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "features",
    timestamps: false,
    underscored: true,
  }
);

export default Feature;
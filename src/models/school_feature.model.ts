import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface SchoolFeatureAttributes {
  id: number;
  school_id: bigint;
  feature_id: number;
  is_enabled?: boolean;
  enabled_at?: Date | null;
}

interface SchoolFeatureCreationAttributes
  extends Optional<SchoolFeatureAttributes, "id"> {}

class SchoolFeature
  extends Model<SchoolFeatureAttributes, SchoolFeatureCreationAttributes>
  implements SchoolFeatureAttributes
{
  public id!: number;
  public school_id!: bigint;
  public feature_id!: number;
  public is_enabled?: boolean;
  public enabled_at?: Date | null;
}

SchoolFeature.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    school_id: { type: DataTypes.BIGINT, allowNull: false },
    feature_id: { type: DataTypes.INTEGER, allowNull: false },
    is_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    enabled_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: "school_features",
    timestamps: false,
    underscored: true,
  }
);

export default SchoolFeature;
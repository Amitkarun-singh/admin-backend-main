import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type TargetType = "class" | "section" | "role" | "user";

interface FeatureOverrideAttributes {
  id: bigint;
  school_id: bigint;
  feature_id: number;
  target_type: TargetType;
  target_id?: bigint | null;
  target_role?: string | null;
  is_enabled: boolean;
  granted_by?: bigint | null;
  created_at?: Date;
}

interface FeatureOverrideCreationAttributes
  extends Optional<FeatureOverrideAttributes, "id"> {}

class FeatureOverride
  extends Model<FeatureOverrideAttributes, FeatureOverrideCreationAttributes>
  implements FeatureOverrideAttributes
{
  public id!: bigint;
  public school_id!: bigint;
  public feature_id!: number;
  public target_type!: TargetType;
  public target_id?: bigint | null;
  public target_role?: string | null;
  public is_enabled!: boolean;
  public granted_by?: bigint | null;
  public created_at?: Date;
}

FeatureOverride.init(
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    school_id: { type: DataTypes.BIGINT, allowNull: false },
    feature_id: { type: DataTypes.INTEGER, allowNull: false },
    target_type: {
      type: DataTypes.ENUM("class", "section", "role", "user"),
      allowNull: false,
    },
    target_id: { type: DataTypes.BIGINT, allowNull: true },
    target_role: { type: DataTypes.STRING(40), allowNull: true },
    is_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    granted_by: { type: DataTypes.BIGINT, allowNull: true },
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "feature_overrides",
    timestamps: false,
    underscored: true,
  }
);

export default FeatureOverride;
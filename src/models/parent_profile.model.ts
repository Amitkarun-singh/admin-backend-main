import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

type Relation = "Father" | "Mother" | "Guardian";

interface ParentProfileAttributes {
  parent_id: bigint;
  user_id?: bigint;
  school_id?: bigint;
  relation?: Relation;
  parent_name?: string;
  status?: string;
}

interface ParentProfileCreationAttributes
  extends Optional<ParentProfileAttributes, "parent_id"> {}

class ParentProfile
  extends Model<ParentProfileAttributes, ParentProfileCreationAttributes>
  implements ParentProfileAttributes
{
  public parent_id!: bigint;
  public user_id?: bigint;
  public school_id?: bigint;
  public relation?: Relation;
  public parent_name?: string;
  public status?: string;
}

ParentProfile.init(
  {
    parent_id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.BIGINT },
    school_id: { type: DataTypes.BIGINT },
    relation: { type: DataTypes.ENUM("Father", "Mother", "Guardian") },
    parent_name: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    tableName: "parent_profiles",
    timestamps: false,
  }
);

export default ParentProfile;
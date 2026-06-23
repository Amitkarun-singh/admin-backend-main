import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AiPptAttributes {
  id: number;
  language: string;
  board: string;
  stream: number;
  class: number;
  subject: number;
  chapter_id: number;
  topic: string;
  ppt?: string | null;
  created_by?: string;
}

interface AiPptCreationAttributes extends Optional<AiPptAttributes, "id"> {}

class AiPpt
  extends Model<AiPptAttributes, AiPptCreationAttributes>
  implements AiPptAttributes
{
  public id!: number;
  public language!: string;
  public board!: string;
  public stream!: number;
  public class!: number;
  public subject!: number;
  public chapter_id!: number;
  public topic!: string;
  public ppt?: string | null;
  public created_by?: string;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AiPpt.init(
  {
    id: {
      type:          DataTypes.INTEGER,
      primaryKey:    true,
      autoIncrement: true,
    },
    language:   { type: DataTypes.STRING,  allowNull: false },
    board:      { type: DataTypes.STRING,  allowNull: false },
    stream:     { type: DataTypes.INTEGER, allowNull: false },
    class:      { type: DataTypes.INTEGER, allowNull: false },
    subject:    { type: DataTypes.INTEGER, allowNull: false },
    chapter_id: { type: DataTypes.INTEGER, allowNull: false },
    topic:      { type: DataTypes.STRING,  allowNull: false },
    ppt:        { type: DataTypes.STRING,  allowNull: true  },
    created_by: { type: DataTypes.STRING,  defaultValue: "Teacher" },
  },
  {
    sequelize,
    tableName:  "ai_ppt",
    timestamps: true,
    createdAt:  "created_at",
    updatedAt:  "updated_at",
  }
);

export default AiPpt;
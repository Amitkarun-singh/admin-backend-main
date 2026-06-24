import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db.js";

interface AiNoteNewAttributes {
  id: number;
  language: string;
  board: string;
  stream?: string | null;
  class: string;
  subject: string;
  topic: string;
  short_notes?: string | null;
  full_notes?: string | null;
  book_url?: string | null;
  created_by?: string;
  chapter_id?: number | null;
}

interface AiNoteNewCreationAttributes
  extends Optional<AiNoteNewAttributes, "id"> {}

class AiNoteNew
  extends Model<AiNoteNewAttributes, AiNoteNewCreationAttributes>
  implements AiNoteNewAttributes
{
  public id!: number;
  public language!: string;
  public board!: string;
  public stream?: string | null;
  public class!: string;
  public subject!: string;
  public topic!: string;
  public short_notes?: string | null;
  public full_notes?: string | null;
  public book_url?: string | null;
  public created_by?: string;
  public chapter_id?: number | null;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AiNoteNew.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    language:    { type: DataTypes.STRING,  allowNull: false },
    board:       { type: DataTypes.STRING,  allowNull: false },
    stream:      { type: DataTypes.STRING,  allowNull: true },
    class:       { type: DataTypes.STRING,  allowNull: false },
    subject:     { type: DataTypes.STRING,  allowNull: false },
    topic:       { type: DataTypes.STRING,  allowNull: false },
    short_notes: { type: DataTypes.TEXT,    allowNull: true },
    full_notes:  { type: DataTypes.STRING,  allowNull: true },
    book_url:    { type: DataTypes.STRING,  allowNull: true },
    created_by:  { type: DataTypes.STRING,  defaultValue: "Teacher" },
    chapter_id:  { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName:  "ai_notes_new",
    timestamps: true,
    createdAt:  "created_at",
    updatedAt:  "updated_at",
  }
);

export default AiNoteNew;
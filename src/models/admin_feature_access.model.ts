import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db.js";

interface AdminFeatureAccessAttributes {
  user_id: bigint;
  ai_chatbot?: boolean;
  ai_notes?: boolean;
  ai_summarization?: boolean;
  ai_practice?: boolean;
  ai_voice_tutor?: boolean;
  english_speaking?: boolean;
  essay_writing?: boolean;
  presentation_generation?: boolean;
}

class AdminFeatureAccess
  extends Model<AdminFeatureAccessAttributes>
  implements AdminFeatureAccessAttributes
{
  public user_id!: bigint;
  public ai_chatbot?: boolean;
  public ai_notes?: boolean;
  public ai_summarization?: boolean;
  public ai_practice?: boolean;
  public ai_voice_tutor?: boolean;
  public english_speaking?: boolean;
  public essay_writing?: boolean;
  public presentation_generation?: boolean;
}

AdminFeatureAccess.init(
  {
    user_id: { type: DataTypes.BIGINT, primaryKey: true },
    ai_chatbot: { type: DataTypes.BOOLEAN },
    ai_notes: { type: DataTypes.BOOLEAN },
    ai_summarization: { type: DataTypes.BOOLEAN },
    ai_practice: { type: DataTypes.BOOLEAN },
    ai_voice_tutor: { type: DataTypes.BOOLEAN },
    english_speaking: { type: DataTypes.BOOLEAN },
    essay_writing: { type: DataTypes.BOOLEAN },
    presentation_generation: { type: DataTypes.BOOLEAN },
  },
  {
    sequelize,
    tableName: "admin_feature_access",
    timestamps: false,
  }
);

export default AdminFeatureAccess;
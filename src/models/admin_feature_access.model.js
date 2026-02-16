import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

export default sequelize.define("AdminFeatureAccess", {
    user_id: { type: DataTypes.BIGINT, primaryKey: true },
    ai_chatbot: DataTypes.BOOLEAN,
    ai_notes: DataTypes.BOOLEAN,
    ai_summarization: DataTypes.BOOLEAN,
    ai_practice: DataTypes.BOOLEAN,
    ai_voice_tutor: DataTypes.BOOLEAN,
    english_speaking: DataTypes.BOOLEAN,
    essay_writing: DataTypes.BOOLEAN,
    presentation_generation: DataTypes.BOOLEAN
},{
    tableName: "admin_feature_access",
    timestamps: false
});

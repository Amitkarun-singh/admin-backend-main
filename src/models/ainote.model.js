import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AiNote = sequelize.define(
    "AiNote",
    {
        // Language: English, Hindi, etc.
        language: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // Board: CBSE, ICSE, State Board
        board: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // Class: 6, 7, 8, 9, 10, 11, 12
        class: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // Subject: Math, Science, History
        subject: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // Topic / Chapter name
        topic: {
            type: DataTypes.STRING,
            allowNull: false,
        },

        // Short notes (2–3 lines)
        short_notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },

        // Full notes (detailed explanation)
        full_notes: {
            type: DataTypes.TEXT("long"),
            allowNull: true,
        },

        // Who generated the notes (AI / Teacher / Admin)
        generated_by: {
            type: DataTypes.STRING,
            defaultValue: "AI",
        },
    },
    {
        tableName: "ai_notes",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);

export default AiNote;

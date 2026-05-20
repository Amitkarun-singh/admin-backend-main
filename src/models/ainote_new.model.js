import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AiNoteNew = sequelize.define(
  "AiNoteNew",
  {
    // Language: English, Hindi, Marathi, etc.
    language: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Board: CBSE, ICSE, State Board
    board: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Stream: Science, Commerce, Arts (optional – for Class 11/12)
    stream: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Class: 6, 7, 8, 9, 10, 11, 12
    class: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Subject: Math, Science, History, etc.
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Topic / Chapter name
    topic: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    // Short notes — entered manually by user from the form
    short_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Full notes — S3 key for uploaded PDF
    full_notes: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Book — S3 key for uploaded book PDF
    book_url: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Who created the entry: "Teacher" | "Admin" (no longer "AI")
    created_by: {
      type: DataTypes.STRING,
      defaultValue: "Teacher",
    },
  },
  {
    tableName: "ai_notes_new",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

export default AiNoteNew;
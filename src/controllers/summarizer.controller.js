import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import "dotenv/config";

// Initialize Gemini client
let ai;

try {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
} catch {
  console.log("GEMINI_API_KEY is required");
}

export async function summarizeFileOrText({ filePath, mimeType, text }) {
  let contents;

  try {
    // -------------------------------
    // CASE 1: FILE UPLOAD
    // -------------------------------
    if (filePath) {
      const file = await ai.files.upload({
        file: filePath,
        config: { mimeType },
      });

      contents = [
        { text: "Summarize this content clearly and concisely." },
        { fileData: { fileUri: file.uri, mimeType } },
      ];
    }

    // -------------------------------
    // CASE 2: RAW TEXT
    // -------------------------------
    else if (text) {
      contents = text;
    } else {
      throw new Error("No file or text provided");
    }

    // -------------------------------
    // GEMINI CALL
    // -------------------------------
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents,
    });

    return response.text;
  } catch (error) {
    console.error("Gemini Summarization Error:", error.message);
    throw error;
  } finally {
    // -------------------------------
    // 🔥 ALWAYS DELETE LOCAL FILE
    // -------------------------------
    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error("File cleanup failed:", err.message);
      }
    }
  }
}

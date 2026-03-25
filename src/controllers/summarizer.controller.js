import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
// import "dotenv/config";

// Initialize Gemini client
let ai;

try {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
} catch {
  console.log("GEMINI_API_KEY is required");
}

const SUMMARY_PROMPT_MAXLENGHT = (language, maxlength) => `
  You are an intelligent AI summarisation assistant designed to help students revise study material quickly.

  Read the provided content carefully and generate structured revision notes.

  Generate the response completely in **${language} language**.

  ${
    maxlength
      ? `The total length of the response must be within approximately ${maxlength} words. Keep it concise while covering all important points.`
      : `Keep the explanation clear, structured, and easy to understand.`
  }

  Use the following structure:

  INTRODUCTION
  Short overview of the topic.

  KEY CONCEPTS
  Use bullet points.

  IMPORTANT FORMULAS
  Include formulas if present.

  IMPORTANT EXAM POINTS
  Important facts or rules useful for exams.

  QUICK SUMMARY
  Short revision recap.

  Guidelines:
  - Use simple student friendly language.
  - Preserve formulas exactly.
  - Do not add information outside the content.
  ${
    maxlength
      ? `- Prioritize the most important points to stay within the word limit.`
      : ``
  }
  `;

const SUMMARY_PROMPT = (language) => `
You are an intelligent AI summarisation assistant designed to help students revise study material quickly.

Read the provided content carefully and generate structured revision notes.

Generate the response completely in **${language} language**.

Use the following structure:

INTRODUCTION
Short overview of the topic.

KEY CONCEPTS
Use bullet points.

IMPORTANT FORMULAS
Include formulas if present.

IMPORTANT EXAM POINTS
Important facts or rules useful for exams.

QUICK SUMMARY
Short revision recap.

Guidelines:
- Use simple student friendly language.
- Preserve formulas exactly.
- Do not add information outside the content.
`;

export async function summarizeFile({ language, maxlength, filePath, mimeType }) {

  try {
    
    const file = await ai.files.upload({
      file: filePath,
      config: { mimeType }
    });

    console.log(maxlength);
    console.log(language);
    
    

    const contents = [
      {
        text: maxlength ? SUMMARY_PROMPT_MAXLENGHT(language, maxlength) : SUMMARY_PROMPT(language)
      },
      {
        fileData: {
          fileUri: file.uri,
          mimeType
        }
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents
    });

    return response.text;

  } catch (error) {

    console.error("AI Summarization Error:", error.message);
    throw error;

  } finally {

    if (filePath) {
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.error("File cleanup failed:", err.message);
      }
    }

  }
}

export function parseNotes(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { short_notes: null };
  }

  let cleaned = rawText;

  /*
  -----------------------------
  Remove markdown headings
  -----------------------------
  */

  cleaned = cleaned.replace(/^#{1,6}\s*/gm, "");

  /*
  -----------------------------
  Remove separators like ---
  -----------------------------
  */

  cleaned = cleaned.replace(/^-{3,}/gm, "");

  /*
  -----------------------------
  Convert numbered lists → bullets
  -----------------------------
  */

  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "• ");

  /*
  -----------------------------
  Normalize bullet symbols
  -----------------------------
  */

  cleaned = cleaned.replace(/^\s*[\*\-]\s+/gm, "• ");

  /*
  -----------------------------
  Remove markdown bold
  -----------------------------
  */

  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1");

  /*
  -----------------------------
  Fix spacing
  -----------------------------
  */

  cleaned = cleaned
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return {
    short_notes: cleaned
  };
}
export const generateSummary = async (req, res) => {
  try {

    const { language, maxlength } = req.body;
    const file = req.file;

    /*
    ------------------------------------------
    Validate Inputs
    ------------------------------------------
    */

    if (!language) {
      return res.status(400).json({
        success: false,
        message: "language is required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "file is required",
      });
    }

    /*
    ------------------------------------------
    1️⃣ Generate AI Summary
    ------------------------------------------
    */

    const aiText = await summarizeFile({
      language,
      maxlength,
      filePath: file.path,
      mimeType: file.mimetype,
    });

    /*
    ------------------------------------------
    2️⃣ Parse / Clean AI Output
    ------------------------------------------
    */

    const parsed = parseNotes(aiText);

    if (!parsed.short_notes) {
      throw new Error(`AI summarization failed for ${file.originalname}`);
    }

    /*
    ------------------------------------------
    3️⃣ Send Response
    ------------------------------------------
    */

    res.status(200).json({
      success: true,
      message: "Summary generated successfully",
      file: file.originalname,
      summary: parsed.short_notes,
    });

  } catch (error) {

    console.error("Generate Summary Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate summary",
    });

  }
};

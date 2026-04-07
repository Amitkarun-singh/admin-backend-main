import AiNote from "../models/ainote.model.js";
import { Sequelize } from "sequelize";
import sequelize from "../config/db.js";
import { GoogleGenAI } from "@google/genai";
import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import { parseNotes } from "../utils/parseNotes.js";
import { uploadToS3 } from "../utils/s3Upload.js";
import fs from "fs";
import { getSignedPdfUrl } from "../utils/signedUrl.js";
// import "dotenv/config";

// Initialize Gemini client
let ai;

try {
  ai ==
    new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
} catch {
  console.log("GEMINI_API_KEY is required");
}

let openai;

try {
  openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
} catch {
  console.log("OPENROUTER_API_KEY is required");
}

/**
 * ============================================
 * 1. Get available Languages
 * GET /api/ainote/languages
 * ============================================
 */
export const getLanguages = async (req, res) => {
  try {
    const languages = await AiNote.findAll({
      attributes: ["language"],
      group: ["language"],
    });

    res.status(200).json({
      success: true,
      data: languages.map((l) => l.language),
    });
  } catch (error) {
    console.error("Get Languages Error:", error);
    res.status(500).json({ success: false });
  }
};

/**
 * ============================================
 * 2. Get Classes (based on language + board)
 * GET /api/ainote/classes
 * ============================================
 */
export const getClasses = async (req, res) => {
  try {
    const { language, board } = req.query;

    if (!language || !board) {
      return res.status(400).json({
        success: false,
        message: "language and board are required",
      });
    }

    const classes = await AiNote.findAll({
      where: { language, board },
      attributes: ["class"],
      group: ["class"],
      order: [[Sequelize.literal("CAST(class AS UNSIGNED)"), "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: classes.map((c) => c.class),
    });
  } catch (error) {
    console.error("Get Classes Error:", error);
    res.status(500).json({ success: false });
  }
};

/**
 * ============================================
 * 3. Get Subjects (based on language + class)
 * GET /api/ainote/subjects
 * ============================================
 */
export const getSubjects = async (req, res) => {
  try {
    const { language, class: className } = req.query;

    if (!language || !className) {
      return res.status(400).json({
        success: false,
        message: "language and class are required",
      });
    }

    const subjects = await AiNote.findAll({
      where: { language, class: className },
      attributes: ["subject"],
      group: ["subject"],
      order: [["subject", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: subjects.map((s) => s.subject),
    });
  } catch (error) {
    console.error("Get Subjects Error:", error);
    res.status(500).json({ success: false });
  }
};

/**
 * ============================================
 * 4. Get Chapters (based on language + class + subject)
 * GET /api/ainote/chapters
 * ============================================
 */
export const getChapters = async (req, res) => {
  try {
    const { language, class: className, subject } = req.query;

    if (!language || !className || !subject) {
      return res.status(400).json({
        success: false,
        message: "language, class and subject are required",
      });
    }

    const chapters = await AiNote.findAll({
      where: { language, class: className, subject },
      attributes: ["topic"],
      group: ["topic"],
      order: [["topic", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: chapters.map((c) => c.topic),
    });
  } catch (error) {
    console.error("Get Chapters Error:", error);
    res.status(500).json({ success: false });
  }
};

/**
 * ============================================
 * 5. Get AI Notes (final fetch)
 * GET /api/ainote
 * ============================================
 */
export const getAiNotes = async (req, res) => {
  try {
    const { language, board, class: className, subject, topic } = req.query;

    const where = {};
    if (language) where.language = language;
    if (board) where.board = board;
    if (className) where.class = className;
    if (subject) where.subject = subject;
    if (topic) where.topic = topic;

    const notes = await AiNote.findAll({
      where,
      order: [["created_at", "ASC"]],
    });

    const updatedNotes = await Promise.all(
      notes.map(async (note) => {
        const signedUrl = await getSignedPdfUrl(note.full_notes);
        const signedBookUrl = await getSignedPdfUrl(note.book_url);

        return {
          ...note.toJSON(),
          pdfUrl: signedUrl, // ✅ frontend will use this
          bookUrl: signedBookUrl, // ✅ frontend will use this
        };
      })
    );


    res.status(200).json({
      success: true,
      count: notes.length,
      data: updatedNotes,
    });
  } catch (error) {
    console.error("Get AI Notes Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch AI notes",
    });
  }
};

export async function generateNotes({
  language,
  board,
  className,
  subject,
  chapter,
}) {
  const prompt = `
            You are an AI notes generation assistant.

            Generate exam-oriented notes in this exact format:

            Short Notes:
            RULES:
            - Generate notes strictly based on the selected subject and chapter.
            - Use very simple, student-friendly language.
            - Keep explanations short and clear.
            - Focus only on important exam points.
            - Use bullet points and short sections.
            - Avoid long paragraphs and unnecessary details.

            OUTPUT FORMAT (STRICTLY FOLLOW):

            Class {class} {subject} – Chapter: {chapter}

            1. Introduction  
            2–3 line overview of the chapter.

            2. Key Concepts  
            Short explanation of the most important concepts.

            3. Important Formulas  
            List only essential formulas.

            4. Important Exam Points  
            Bullet list of key facts.

            5. Quick Summary  
            Very short final revision.

            Now generate notes in the same format for:

            Board: ${board}
            Class: ${className}
            Subject: ${subject}
            Chapter: ${chapter}
            Language: ${language}
            `;

  try {
    const response = await openai.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages: [
        {
          role: "system",
          content: "You generate structured educational notes for students.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const text = response?.choices?.[0]?.message?.content;

    if (text) {
      console.log("Generated using OpenAI");
      return text;
    }
    throw new Error("Empty OpenAI response");
  } catch (openaiError) {
    console.warn("OpenAI failed, switching to Gemini...");

    // ----------- FALLBACK TO GEMINI -----------
    try {
      const response = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });

      const text =
        response?.text || response?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) throw new Error("Empty Gemini response");

      console.log("Generated using Gemini");
      return text;
    } catch (geminiError) {
      console.error("Both OpenAI and Gemini failed");
      throw new Error("AI services unavailable");
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(fn, retries = 3) {
  try {
    return await fn();
  } catch (err) {
    if (err.status === 429 && retries > 0) {
      await sleep(4000);
      return retry(fn, retries - 1);
    }
    throw err;
  }
}

export const generateAiNotes = async (req, res) => {
  const transaction = await sequelize.transaction();

  // ✅ Collect all temp paths BEFORE try block so finally can always access them
  const allTempFiles = [
    ...(req.files?.notes || []),
    ...(req.files?.books || []),
  ].map(f => f.path);

  try {
    const { language, board, class: className, subject, chapters } = req.body;

    const chapterList = JSON.parse(chapters);

    console.log("chapterList length:", chapterList.length);
    console.log("noteFiles length:", req.files?.notes?.length);
    console.log("bookFiles length:", req.files?.books?.length);

    const noteFiles = req.files.notes;
    const bookFiles = req.files.books;

    if (!noteFiles || noteFiles.length !== chapterList.length) {
      throw new Error(
        `Notes files mismatch: expected ${chapterList.length}, got ${noteFiles?.length ?? 0}`
      );
    }

    if (!bookFiles || bookFiles.length !== chapterList.length) {
      throw new Error(
        `Books files mismatch: expected ${chapterList.length}, got ${bookFiles?.length ?? 0}`
      );
    }

    const results = [];

    for (let i = 0; i < chapterList.length; i++) {
      const topic = chapterList[i].trim();
      const noteFile = noteFiles[i];
      const bookFile = bookFiles[i];

      const bookUpload = await uploadToS3(bookFile, "Books", language, board, className, subject, topic);
      const bookKey = bookUpload.key;

      const noteUpload = await uploadToS3(noteFile, "Notes", language, board, className, subject, topic);
      const noteKey = noteUpload.key;

      const aiText = await generateNotes({ language, board, className, subject, chapter: topic });
      const parsed = parseNotes(aiText);

      const note = await AiNote.create(
        {
          language,
          board,
          class: className,
          subject,
          topic,
          short_notes: parsed.short_notes,
          full_notes: noteKey,
          book_url: bookKey,
          generated_by: "AI",
        },
        { transaction }
      );

      results.push({ topic, noteKey, bookKey, id: note.id });

      await sleep(2000);
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "AI Notes + Books uploaded successfully",
      results,
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Generate AI Notes Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });

  } finally {
    // ✅ Always runs — deletes ALL temp files after success or failure
    for (const filePath of allTempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🗑️ Deleted temp file: ${filePath}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not delete temp file ${filePath}:`, err.message);
      }
    }
  }
};
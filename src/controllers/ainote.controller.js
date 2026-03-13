import AiNote from "../models/ainote.model.js";
import { Sequelize } from "sequelize";
import sequelize from "../config/db.js";
import { GoogleGenAI } from "@google/genai";
import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import { parseNotes } from "../utils/parseNotes.js";
import { uploadOnHostinger } from "../utils/hostingerStorage.js";
import "dotenv/config";

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

    res.status(200).json({
      success: true,
      count: notes.length,
      data: notes,
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

  try {
    const { language, board, class: className, subject, chapters } = req.body;

    if (!language || !board || !className || !subject || !chapters) {
      return res.status(400).json({
        success: false,
        message: "language, board, class, subject and chapters are required",
      });
    }

    const chapterList = JSON.parse(chapters);
    const files = req.files;

    if (!Array.isArray(chapterList) || chapterList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "chapters must be a valid array",
      });
    }

    if (!files || files.length !== chapterList.length) {
      return res.status(400).json({
        success: false,
        message: "Number of files must match chapters",
      });
    }

    const results = [];

    for (let i = 0; i < chapterList.length; i++) {
      const topic = chapterList[i].trim();
      const file = files[i];

      if (!topic || !file) {
        throw new Error("Invalid chapter or file");
      }

      /*
      ------------------------------------------
      1️⃣ Upload PDF to Hostinger
      ------------------------------------------
      */

      const uploadResult = await uploadOnHostinger(
        file.path,
        className,
        subject,
        topic
      );

      const pdfUrl = uploadResult.url;

      /*
      ------------------------------------------
      2️⃣ Generate AI short notes
      ------------------------------------------
      */

      const aiText = await generateNotes({
        language,
        board,
        className,
        subject,
        chapter: topic,
      });

      const parsed = parseNotes(aiText);

      if (!parsed.short_notes) {
        throw new Error(`AI generation failed for ${topic}`);
      }

      /*
      ------------------------------------------
      3️⃣ Save in DB
      ------------------------------------------
      */

      const note = await AiNote.create(
        {
          language,
          board,
          class: className,
          subject,
          topic,
          short_notes: parsed.short_notes,
          full_notes: pdfUrl,
          generated_by: "AI",
        },
        { transaction }
      );

      results.push({
        topic,
        pdf: pdfUrl,
        id: note.id,
      });

      /*
      Delay for AI API rate limits
      */

      await sleep(2000);
    }

    /*
    ------------------------------------------
    Commit transaction
    ------------------------------------------
    */

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "AI Notes generated successfully",
      results,
    });
  } catch (error) {
    /*
    ------------------------------------------
    Rollback if anything fails
    ------------------------------------------
    */

    await transaction.rollback();

    console.error("Generate AI Notes Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to generate AI notes. No data stored.",
    });
  }
};


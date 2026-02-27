import AiNote from "../models/ainote.model.js";
import { Sequelize } from "sequelize";
import { GoogleGenAI } from "@google/genai";
import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import { parseNotes } from "../utils/parseNotes.js";
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
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:3000", // your app URL
      "X-Title": "AI Notes App", // your app name
    },
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

// export async function generateNotes({
//     language,
//     board,
//     className,
//     subject,
//     chapter,
//     type,
//     }) {
//     try {
//         let instruction = "";

//         if (type === "short") {
//         instruction = `
//             You are an AI notes generation assistant designed to help students revise quickly using short, exam-oriented notes.

//             RULES:
//             - Generate notes strictly based on the selected subject and chapter.
//             - Use very simple, student-friendly language.
//             - Keep explanations short and clear.
//             - Focus only on important exam points.
//             - Use bullet points and short sections.
//             - Avoid long paragraphs and unnecessary details.

//             OUTPUT FORMAT (STRICTLY FOLLOW):

//             Class {class} {subject} – Chapter: {chapter}

//             1. Introduction
//             2–3 line overview of the chapter.

//             2. Key Concepts
//             Short explanation of the most important concepts.

//             3. Important Formulas
//             List only essential formulas.

//             4. Important Exam Points
//             Bullet list of key facts.

//             5. Quick Summary
//             Very short final revision.

//             EXAMPLE OUTPUT:

//             Class 10 Science – Chapter: Electricity

//             1. Introduction
//             Electricity deals with the flow of electric charge in a conductor.

//             2. Key Concepts
//             - Electric current: Flow of charge
//             - Potential difference: Work done per unit charge
//             - Resistance: Opposition to current flow

//             3. Important Formulas
//             - I = Q / t
//             - V = IR
//             - P = VI

//             4. Important Exam Points
//             - Ammeter in series
//             - Voltmeter in parallel
//             - Household wiring uses parallel circuits

//             5. Quick Summary
//             Electricity involves current, voltage, resistance, and power.

//             Now generate notes in the same format for:`;
//         } else {
//         instruction = `
//             You are an AI notes generation assistant designed to help students study and understand concepts using structured, exam-oriented detailed notes.

//             RULES:
//             - Generate notes strictly based on the selected subject and chapter.
//             - Organize content into clear numbered sections.
//             - Explain concepts in simple, student-friendly language.
//             - Highlight key definitions, formulas, rules, and important points.
//             - Use bullet points, numbered lists, and short paragraphs.
//             - Focus more on important exam topics.
//             - Maintain logical flow and readability.

//             OUTPUT FORMAT (STRICTLY FOLLOW):

//             Class {class} {subject} – Chapter: {chapter}

//             1. Introduction
//             Short explanation of the chapter.

//             2. Main Concepts
//             Explain each important concept with headings and short explanations.

//             3. Important Definitions
//             List key definitions.

//             4. Important Formulas
//             List all formulas clearly.

//             5. Important Exam Points
//             Bullet list of important facts.

//             6. Summary
//             Short final revision summary.

//             EXAMPLE OUTPUT:

//             Class 10 Science – Chapter: Electricity

//             1. Introduction
//             Electricity is the flow of electric charge through a conductor.

//             2. Main Concepts

//             2.1 Electric Current
//             Rate of flow of electric charge.
//             Formula: I = Q / t
//             Unit: Ampere (A)

//             2.2 Potential Difference
//             Work done to move a unit charge.
//             Formula: V = W / Q
//             Unit: Volt (V)

//             2.3 Ohm’s Law
//             V = IR
//             Current is directly proportional to voltage at constant temperature.

//             3. Important Definitions
//             - Current: Flow of charge
//             - Resistance: Opposition to current

//             4. Important Formulas
//             - I = Q / t
//             - V = IR
//             - P = VI

//             5. Important Exam Points
//             - Ammeter is connected in series
//             - Voltmeter is connected in parallel
//             - Household circuits use parallel connection

//             6. Summary
//             Electricity includes current, voltage, resistance, and power relationships.

//             Now generate notes in the same format for:`;
//         }

//         const prompt = `
//     Generate ${type} notes in ${language} for:

//     Board: ${board}
//     Class: ${className}
//     Subject: ${subject}
//     Chapter: ${chapter}

//     ${instruction}
//     Make the content suitable for school students.
//     `;

//         // const response = await ai.models.generateContent({
//         // model: "gemini-2.0-flash",
//         // contents: prompt,
//         // });

//         const response = await openai.chat.completions.create({
//             model: "deepseek/deepseek-r1-0528:free",
//             messages: [
//                 {
//                     role: "system",
//                     content:
//                         "You are a helpful assistant that generates educational notes for students.",
//                 },
//                 {
//                     role: "user",
//                     content: prompt,
//                 },
//             ],
//         });

//         return response.choices[0].message.content;
//     } catch (error) {
//         console.error("Gemini Note Generation Error:", error.message);
//         throw error;
//     }
// }

// export const generateAiNotes = async (req, res) => {
//     try {
//         const {
//             language,
//             board,
//             class: className,
//             subject,
//             chapter,
//         } = req.body;

//         if (!language || !board || !className || !subject || !chapter) {
//             return res.status(400).json({
//                 success: false,
//                 message:
//                     "language, board, class, subject, and chapter are required",
//             });
//         }

//         const chapters = Array.isArray(chapter) ? chapter : [chapter];
//         const results = [];

//         for (const ch of chapters) {
//             const topic = ch.trim();
//             if (!topic) continue;

//             // ---- Generate short notes ----
//             const shortText = await generateNotes({
//                 language,
//                 board,
//                 className,
//                 subject,
//                 chapter: topic,
//                 type: "short",
//             });
//             console.log(shortText);

//             // const shortParsed = parseNotes(shortText);

//             console.log('====================================');
//             // console.log(shortParsed);
//             console.log('====================================');

//             // ---- Generate full notes ----
//             const fullText = await generateNotes({
//                 language,
//                 board,
//                 className,
//                 subject,
//                 chapter: topic,
//                 type: "full",
//             });
//             console.log(fullText);
//             // const fullParsed = parseNotes(fullText);

//             // ---- Store in DB ----
//             let note = await AiNote.findOne({
//                 where: {
//                     language,
//                     board,
//                     class: className,
//                     subject,
//                     topic,
//                 },
//             });

//             if (!note) {
//                 note = await AiNote.create({
//                     language,
//                     board,
//                     class: className,
//                     subject,
//                     topic,
//                     short_notes: shortText,
//                     full_notes: fullText,
//                     generated_by: "AI",
//                 });

//                 results.push({
//                     topic,
//                     status: "created",
//                 });
//             } else {
//                 note.short_notes = shortText;
//                 note.full_notes = fullText;
//                 await note.save();

//                 results.push({
//                     topic,
//                     status: "updated",
//                 });
//             }
//         }

//         res.status(200).json({
//             success: true,
//             message: "Short and full notes generated successfully",
//             results,
//         });
//     } catch (error) {
//         console.error("Generate AI Notes Error:", error);
//         res.status(500).json({
//             success: false,
//             message: "Failed to generate AI notes",
//         });
//     }
// };

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

            Full Notes:
            RULES:
            - Generate notes strictly based on the selected subject and chapter.
            - Organize content into clear numbered sections.
            - Explain concepts in simple, student-friendly language.
            - Highlight key definitions, formulas, rules, and important points.
            - Use bullet points, numbered lists, and short paragraphs.
            - Focus more on important exam topics.
            - Maintain logical flow and readability.

            OUTPUT FORMAT (STRICTLY FOLLOW):

            Class {class} {subject} – Chapter: {chapter}

            1. Introduction  
            Short explanation of the chapter.

            2. Main Concepts  
            Explain each important concept with headings and short explanations.

            3. Important Definitions  
            List key definitions.

            4. Important Formulas  
            List all formulas clearly.

            5. Important Exam Points  
            Bullet list of important facts.

            6. Summary  
            Short final revision summary.

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
  try {
    const { language, board, class: className, subject, chapter } = req.body;

    if (!language || !board || !className || !subject || !chapter) {
      return res.status(400).json({
        success: false,
        message: "language, board, class, subject, and chapter are required",
      });
    }

    const chapters = Array.isArray(chapter) ? chapter : [chapter];
    const results = [];

    for (const ch of chapters) {
      const topic = ch.trim();
      if (!topic) continue;

      // single AI call with retry
      const aiText = await retry(() =>
        generateNotes({
          language,
          board,
          className,
          subject,
          chapter: topic,
        }),
      );

      const parsed = parseNotes(aiText);

      // DB logic
      let note = await AiNote.findOne({
        where: {
          language,
          board,
          class: className,
          subject,
          topic,
        },
      });

      if (!note) {
        note = await AiNote.create({
          language,
          board,
          class: className,
          subject,
          topic,
          short_notes: parsed.short_notes,
          full_notes: parsed.full_notes,
          generated_by: "AI",
        });

        results.push({ topic, status: "created" });
      } else {
        note.short_notes = parsed.short_notes;
        note.full_notes = parsed.full_notes;
        await note.save();

        results.push({ topic, status: "updated" });
      }

      // delay between chapters (free-tier safe)
      await sleep(2000);
    }

    res.status(200).json({
      success: true,
      message: "Notes generated successfully",
      results,
    });
  } catch (error) {
    console.error("Generate AI Notes Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate AI notes",
    });
  }
};

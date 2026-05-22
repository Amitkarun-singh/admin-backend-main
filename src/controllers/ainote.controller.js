import AiNoteNew from "../models/ainote_new.model.js";
import { Sequelize, Op } from "sequelize";
import sequelize from "../config/db.js";
import { uploadToS3 } from "../utils/s3Upload.js";
import fs from "fs";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Classes that require a stream selection */
const STREAM_CLASSES = ["11", "12"];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Returns true when the given class requires a stream (11 or 12).
 * Accepts both string and number.
 */
function requiresStream(className) {
  return STREAM_CLASSES.includes(String(className));
}

/**
 * Build a Sequelize `where` clause that handles stream correctly:
 *  - class 11/12 → filter by the provided stream value
 *  - other classes → always force stream IS NULL
 *
 * This prevents cross-contamination (e.g. class-10 records leaking into
 * class-11 Science stream results).
 */
function buildStreamCondition(className, stream) {
  if (requiresStream(className)) {
    // stream is mandatory for 11/12 — caller should have validated this
    return { stream: stream ?? null };
  }
  // For all other classes, stream must be NULL in the DB
  return { stream: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Get available Languages
// GET /api/ainote-new/languages
// ─────────────────────────────────────────────────────────────────────────────
export const getLanguages = async (req, res) => {
  try {
    const languages = await AiNoteNew.findAll({
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

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Boards
// GET /api/ainote-new/boards?language=
// ─────────────────────────────────────────────────────────────────────────────
export const getBoards = async (req, res) => {
  try {
    const { language } = req.query;

    if (!language) {
      return res.status(400).json({
        success: false,
        message: "language is required",
      });
    }

    const boards = await AiNoteNew.findAll({
      where: { language },
      attributes: ["board"],
      group: ["board"],
      order: [["board", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: boards.map((b) => b.board),
    });
  } catch (error) {
    console.error("Get Boards Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch boards" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Get Classes
// GET /api/ainote-new/classes?language=&board=
// ─────────────────────────────────────────────────────────────────────────────
export const getClasses = async (req, res) => {
  try {
    const { language, board } = req.query;

    if (!language || !board) {
      return res.status(400).json({
        success: false,
        message: "language and board are required",
      });
    }

    const classes = await AiNoteNew.findAll({
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
    res.status(500).json({ success: false, message: "Failed to fetch classes" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Get Streams  (only meaningful for class 11 & 12)
// GET /api/ainote-new/streams?language=&board=
//
// Returns distinct non-null stream values.
// Frontend should call this only after the user picks class 11 or 12.
// ─────────────────────────────────────────────────────────────────────────────
export const getStreams = async (req, res) => {
  try {
    const { language, board } = req.query;

    if (!language || !board) {
      return res.status(400).json({
        success: false,
        message: "language and board are required",
      });
    }

    const streams = await AiNoteNew.findAll({
      where: {
        language,
        board,
        class: { [Op.in]: STREAM_CLASSES },  // only 11 & 12 have streams
        stream: { [Op.ne]: null },            // exclude NULL rows
      },
      attributes: ["stream"],
      group: ["stream"],
      order: [["stream", "ASC"]],
    });

    res.status(200).json({
      success: true,
      data: streams.map((s) => s.stream),
    });
  } catch (error) {
    console.error("Get Streams Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch streams" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. Get Subjects
// GET /api/ainote-new/subjects?language=&board=&class=  [&stream= for 11/12]
// ─────────────────────────────────────────────────────────────────────────────
export const getSubjects = async (req, res) => {
  try {
    const { language, board, class: className, stream } = req.query;

    if (!language || !board || !className) {
      return res.status(400).json({
        success: false,
        message: "language, board and class are required",
      });
    }

    // For class 11/12 stream is required
    if (requiresStream(className) && !stream) {
      return res.status(400).json({
        success: false,
        message: "stream is required for class 11 and 12",
      });
    }

    const subjects = await AiNoteNew.findAll({
      where: {
        language,
        board,
        class: className,
        ...buildStreamCondition(className, stream),
      },
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
    res.status(500).json({ success: false, message: "Failed to fetch subjects" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Get Chapters
// GET /api/ainote-new/chapters?language=&board=&class=&subject=  [&stream=]
// ─────────────────────────────────────────────────────────────────────────────
export const getChapters = async (req, res) => {
  try {
    const { language, board, class: className, subject, stream } = req.query;

    if (!language || !board || !className || !subject) {
      return res.status(400).json({
        success: false,
        message: "language, board, class and subject are required",
      });
    }

    if (requiresStream(className) && !stream) {
      return res.status(400).json({
        success: false,
        message: "stream is required for class 11 and 12",
      });
    }

    const chapters = await AiNoteNew.findAll({
      where: {
        language,
        board,
        class: className,
        subject,
        ...buildStreamCondition(className, stream),
      },
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
    res.status(500).json({ success: false, message: "Failed to fetch chapters" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. Get Notes  (final fetch with signed URLs)
// GET /api/ainote-new?language=&board=&class=&subject=&topic=  [&stream=]
// ─────────────────────────────────────────────────────────────────────────────
export const getAiNotes = async (req, res) => {
  try {
    const { language, board, class: className, subject, topic, stream } = req.query;

    const where = {};
    if (language)  where.language = language;
    if (board)     where.board    = board;
    if (subject)   where.subject  = subject;
    if (topic)     where.topic    = topic;

    // Apply class + stream together so the filter is always consistent
    if (className) {
      where.class = className;
      Object.assign(where, buildStreamCondition(className, stream));
    }

    const notes = await AiNoteNew.findAll({
      where,
      order: [["created_at", "ASC"]],
    });

    const updatedNotes = await Promise.all(
      notes.map(async (note) => {
        const signedUrl     = await getSignedPdfUrl(note.full_notes);
        const signedBookUrl = await getSignedPdfUrl(note.book_url);

        return {
          ...note.toJSON(),
          pdfUrl:  signedUrl,
          bookUrl: signedBookUrl,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: updatedNotes.length,
      data:  updatedNotes,
    });
  } catch (error) {
    console.error("Get AI Notes Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch notes",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. Create AI Notes  (batch upload)
// POST /api/ainote-new  — multipart/form-data
//
// Body fields:
//   language, board, class, subject
//   stream?               — required when class is 11 or 12, must be null otherwise
//   chapters              — JSON string: string[]
//   short_notes?          — JSON string: (string|null)[]  same length as chapters
//   noteChapterIndices?   — JSON string: number[]  0-based indices with a note PDF
//   bookChapterIndices?   — JSON string: number[]  0-based indices with a book PDF
//   notes[]               — PDF files  (count must equal noteChapterIndices.length)
//   books[]               — PDF files  (count must equal bookChapterIndices.length)
//   created_by?           — default "AI"
// ─────────────────────────────────────────────────────────────────────────────
export const createAiNotes = async (req, res) => {
  const transaction = await sequelize.transaction();

  // Collect all temp file paths up-front so `finally` can always clean them
  const allTempFiles = [
    ...(req.files?.notes || []),
    ...(req.files?.books || []),
  ].map((f) => f.path);

  try {
    const {
      language,
      board,
      class: className,
      subject,
      stream,
      chapters,
      short_notes: shortNotesRaw,
      noteChapterIndices: noteIndicesRaw,
      bookChapterIndices: bookIndicesRaw,
      created_by = "AI",
    } = req.body;

    // ── Validate required text fields ─────────────────────────────────────
    if (!language || !board || !className || !subject || !chapters) {
      return res.status(400).json({
        success: false,
        message: "language, board, class, subject and chapters are required",
      });
    }

    // ── Stream validation ─────────────────────────────────────────────────
    if (requiresStream(className) && !stream) {
      return res.status(400).json({
        success: false,
        message: "stream is required for class 11 and 12",
      });
    }

    if (!requiresStream(className) && stream) {
      return res.status(400).json({
        success: false,
        message: `stream must not be provided for class ${className}`,
      });
    }

    // The stream value to store — null for classes other than 11/12
    const resolvedStream = requiresStream(className) ? stream : null;

    const chapterList    = JSON.parse(chapters);
    const shortNotesList = shortNotesRaw ? JSON.parse(shortNotesRaw) : [];

    // Parse index arrays — safe default to [] when not sent
    const noteIndices = noteIndicesRaw ? JSON.parse(noteIndicesRaw) : [];
    const bookIndices = bookIndicesRaw ? JSON.parse(bookIndicesRaw) : [];

    const noteFiles = req.files?.notes || [];
    const bookFiles = req.files?.books || [];

    console.log("chapters count     :", chapterList.length);
    console.log("stream             :", resolvedStream);
    console.log("noteFiles count    :", noteFiles.length);
    console.log("bookFiles count    :", bookFiles.length);
    console.log("noteChapterIndices :", noteIndices);
    console.log("bookChapterIndices :", bookIndices);

    // ── Validate: index arrays must match actual file counts ──────────────
    if (noteFiles.length !== noteIndices.length) {
      throw new Error(
        `noteChapterIndices length (${noteIndices.length}) must match notes file count (${noteFiles.length})`
      );
    }

    if (bookFiles.length !== bookIndices.length) {
      throw new Error(
        `bookChapterIndices length (${bookIndices.length}) must match books file count (${bookFiles.length})`
      );
    }

    // ── Validate: indices must be within chapter range ────────────────────
    for (const idx of noteIndices) {
      if (idx < 0 || idx >= chapterList.length) {
        throw new Error(
          `noteChapterIndices contains out-of-range index ${idx} (chapters length: ${chapterList.length})`
        );
      }
    }

    for (const idx of bookIndices) {
      if (idx < 0 || idx >= chapterList.length) {
        throw new Error(
          `bookChapterIndices contains out-of-range index ${idx} (chapters length: ${chapterList.length})`
        );
      }
    }

    // ── Build sparse maps: chapterIndex → File ────────────────────────────
    const noteFileMap = {};
    noteIndices.forEach((chIdx, fileIdx) => {
      noteFileMap[chIdx] = noteFiles[fileIdx];
    });

    const bookFileMap = {};
    bookIndices.forEach((chIdx, fileIdx) => {
      bookFileMap[chIdx] = bookFiles[fileIdx];
    });

    const results = [];

    for (let i = 0; i < chapterList.length; i++) {
      const topic      = chapterList[i].trim();
      const shortNotes = shortNotesList[i] ?? null;
      const noteFile   = noteFileMap[i] ?? null;
      const bookFile   = bookFileMap[i] ?? null;

      let noteKey = null;
      let bookKey = null;

      if (bookFile) {
        const bookUpload = await uploadToS3(
          bookFile, "Books", language, board, className, subject, topic
        );
        bookKey = bookUpload.key;
        console.log(`✅ Book uploaded for chapter [${i}] "${topic}":`, bookKey);
      }

      if (noteFile) {
        const noteUpload = await uploadToS3(
          noteFile, "Notes", language, board, className, subject, topic
        );
        noteKey = noteUpload.key;
        console.log(`✅ Note uploaded for chapter [${i}] "${topic}":`, noteKey);
      }

      const note = await AiNoteNew.create(
        {
          language,
          board,
          stream:      resolvedStream,   // null for class ≤ 10, value for 11/12
          class:       className,
          subject,
          topic,
          short_notes: shortNotes,
          full_notes:  noteKey,
          book_url:    bookKey,
          created_by,
        },
        { transaction }
      );

      results.push({ index: i, topic, noteKey, bookKey, id: note.id });

      await sleep(500);
    }

    await transaction.commit();

    res.status(200).json({
      success: true,
      message: "Notes uploaded successfully",
      results,
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Create Notes Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });

  } finally {
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
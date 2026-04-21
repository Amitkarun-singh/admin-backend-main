import OpenAI from "openai";
import pdf from "@cedrugs/pdf-parse"; // ESM-friendly PDF parser
import Tesseract from "tesseract.js";

import { ChatBotFeedbackSave } from "../../modal/chatbot.modal.js";
import dotEnv from "dotenv";
dotEnv.config();
import { fromBuffer } from "pdf2pic";
import { LLMFactory } from "../../pattern_imp/factory/LLMFactory.ts";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Stream AI response to client
 * @param {*} messages - Array of user messages
 * @param {*} res - Express response object (SSE)
 * @param {*} file - Optional uploaded file
 */
export const streamChatbotResponse = async (
  messages,
  res,
  file = null,
  language = "",
  className = "",
  chapter = "",
) => {
  console.log("Gini chat bot service ");
  let messageWithPrompt;

  if (file) {
    const messageWithFile = await mergeMessagesWithFile(messages, file);
    messageWithPrompt = mergeMessageWithPrompt(messageWithFile, {
      language,
      className,
      chapter,
    });
  } else {
    messageWithPrompt = mergeMessageWithPrompt(messages, {
      language,
      className,
      chapter,
    });
  }

  const chatbot = LLMFactory.create("openai");
  await chatbot.streamResponse(messageWithPrompt, res);
};

export const feedbackThumbUpService = async (feedback) => {
  try {
    await ChatBotFeedbackSave([
      feedback.userMessage,
      feedback.response,
      "LIKE",
    ]);

    return true;
  } catch (err) {
    console.error(err);
    throw err;
  }
};
export const feedbackThumbDownService = async (feedback) => {
  try {
    await await ChatBotFeedbackSave([
      feedback.userMessage,
      feedback.response,
      feedback.feedback,
    ]);
    return true;
  } catch (err) {
    throw err;
  }
};

const extractFileText = async (file) => {
  if (!file) return "";

  try {
    const mime = file.mimetype;

    /* IMAGE */
    if (mime.startsWith("image/")) {
      const {
        data: { text },
      } = await Tesseract.recognize(file.buffer, "eng");
      return text.trim();
    }

    /* PDF */
    if (mime === "application/pdf") {
      const pdfData = await pdf(file.buffer);

      if (pdfData.text && pdfData.text.trim().length > 50) {
        return pdfData.text.trim();
      }

      // fallback OCR
      try {
        const convert = fromBuffer(file.buffer, {
          density: 200,
          format: "png",
          width: 1200,
          height: 1600,
        });

        const pages = await convert.bulk(-1);

        let fullText = "";

        for (const page of pages) {
          const {
            data: { text },
          } = await Tesseract.recognize(page.base64, "eng");

          fullText += text + "\n";
        }

        return fullText.trim();
      } catch (ocrError) {
        console.error("OCR tools missing. Skipping OCR.");
        return pdfData.text || "";
      }
    }

    return "Unable to read File";
  } catch (error) {
    console.error("File extraction error:", error);
    return "";
  }
};

async function mergeMessagesWithFile(messages, file) {
  const fileContent = await extractFileText(file);

  if (!fileContent) return messages;

  return [
    ...messages,
    {
      role: "user",
      content: `The following content is from the uploaded file (${file.originalname}):\n\n${fileContent}`,
    },
  ];
}

function mergeMessageWithPrompt(messages, { language, className, chapter }) {
  return [
    {
      role: "system",
      content: getSystemPrompt({ language, className, chapter }),
    },
    ...messages,
  ];
}

function getSystemPrompt({ language, className, chapter }) {
  return `
You are a friendly AI tutor helping a school student learn.

STUDENT CONTEXT
- Class: ${className}
- Subject / Chapter: ${chapter}
- Language: ${language}

YOUR ROLE
You are teaching according to the syllabus and difficulty level of Class ${className}.
All explanations must match the understanding level of a Class ${className} student.

TEACHING STYLE
- Explain concepts step-by-step
- Use simple and student-friendly language
- Keep answers concise and clear
- Give examples when helpful
- Focus only on the question asked
- Always reply in ${language}

CONTEXT AWARENESS
You must remember the current learning context.

If the student asks:
- "Which class am I in?" → reply: "You are studying in Class ${className}."
- "Which class are you teaching?" → reply: "I am teaching at the Class ${className} level."
- "What chapter are we studying?" → reply: "We are studying ${chapter}."

SAFETY RULES
Because you are helping a student, you must follow these safety rules:

1. Do NOT provide:
   - harmful, violent, illegal, or dangerous instructions
   - sexual or adult content
   - hate speech or harassment
   - self-harm related guidance

2. If a student asks for unsafe content:
   - politely refuse
   - briefly explain it is not appropriate
   - encourage safe and positive learning

3. Do NOT help with cheating such as:
   - answering live exams or tests
   - bypassing school rules
Instead encourage learning and understanding.

4. If the student is confused or frustrated:
   - respond kindly
   - encourage them to keep learning

5. Only teach topics appropriate for Class ${className} level.

GOAL
Your goal is to help the student understand the topic "${chapter}" clearly and safely.
`;
}

import OpenAI from "openai";
import pdf from "@cedrugs/pdf-parse"; // ESM-friendly PDF parser
import Tesseract from "tesseract.js";
import { errorMessage } from "../../../../error.js";
import { ChatBotFeedbackSave } from "../../modal/chatbot.modal.js";
import dotEnv from "dotenv";
dotEnv.config();

let openai;

try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} catch (error) {
  console.error("Gini chat bot service | OPENAI_API_KEY required", error);
  errorMessage.push({ error, msg: "OPENAI_API_KEY required" });
}

/**
 * Extract text from uploaded file (PDF or image)
 */
const extractFileText = async (file) => {
  if (!file) return "";

  const mime = file.mimetype;

  try {
    if (mime === "application/pdf") {
      const data = await pdf(file.buffer);
      return data.text;
    } else if (mime.startsWith("image/")) {
      const {
        data: { text },
      } = await Tesseract.recognize(file.buffer, "eng", {
        // logger: (m) => console.log(m), // optional progress logging
      });
      return text;
    } else {
      return ""; // unsupported file
    }
  } catch (err) {
    console.error("File extraction error:", err);
    errorMessage.push(err);
    return "";
  }
};

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
  language,
  className = "",
  chapter = "",
) => {
  console.log("Gini chat bot service ");

  try {
    // Extract file text if uploaded
    let fileContent = "";
    if (file) {
      fileContent = await extractFileText(file);
      if (fileContent) {
        messages.push({
          role: "user",
          content: `The following content is from the uploaded file (${file.originalname}):\n\n${fileContent}`,
        });
      }
    }

    console.log("className", className);

    const systemPrompt = `
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

    const finalMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const stream = await openai.chat.completions.create({
      // model: "tngtech/deepseek-r1t-chimera:free",
      model: "gpt-4o-mini",
      messages: finalMessages,
      stream: true,
      max_tokens: 1200,
    });

    //Stream AI response to frontend
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        res.write(
          `data: ${JSON.stringify({
            choices: [{ delta: { content } }],
          })}\n\n`,
        );
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Gini chat bot service  | Streaming Service Error:", error);
    res.write("data: [DONE]\n\n");
    res.end();
  }
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

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
    apiKey: process.env.OPENROUTER_API_KEY,
  });
} catch (error) {
  console.error("Gini chat bot service | OPENROUTER_API_KEY required", error);
  errorMessage.push({ error, msg: "OPENROUTER_API_KEY required" });
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

    const systemPrompt = `
You are an AI tutor for students .
Rules:
- Give clear, step-by-step explanations
- Be concise and student-friendly
- Do NOT include internal reasoning
- Focus only on the question asked
- reply only in ${language}
- reply from class ${className} and subject ${className}
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

    // Stream AI response to frontend
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

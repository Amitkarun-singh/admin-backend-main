import { v4 as uuidv4 } from "uuid";
import pool from "../db/db.js";

export const chatbotLogs = (req, res, next) => {
  const originalJson = res.json;
  let responseBody;

  const insertQuery = `
    INSERT INTO chatbot_logs
    (conversation_id, method, url, status_code, device, messages, language, class, subject, file_name, response_body, created_at, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let responseChunks = [];

  // intercept res.write (for streaming)
  const originalWrite = res.write;
  res.write = function (chunk, ...args) {
    responseChunks.push(chunk.toString());
    return originalWrite.apply(res, [chunk, ...args]);
  };

  res.on("finish", () => {
    try {
      const now = new Date();

      let messages = req.body.messages ? JSON.parse(req.body.messages) : null;
      messages = messages[messages.length - 1];

      const userId = req.user.user_id;

      const responseBody = parseSSEChunks(responseChunks); // responseChunks.join("");

      const values = [
        req.body.conversation_id || uuidv4(),
        req.method,
        req.originalUrl,
        res.statusCode,
        req.headers["user-agent"],
        JSON.stringify(messages),
        req.body.language || null,
        req.body.class || null,
        req.body.subject || null,
        req.file ? req.file.originalname : null,
        JSON.stringify(responseBody),
        now,
        userId,
      ];

      pool.query(insertQuery, values, (err) => {
        if (err) {
          console.error("Chatbot log error:", err.message);
        }
      });
    } catch (err) {
      console.error("Logging middleware error:", err.message);
    }
  });

  next();
};

const parseSSEChunks = (responseChunks) => {
  let aiResponse = "";

  for (const chunk of responseChunks) {
    const lines = chunk.split("\n");

    for (let line of lines) {
      if (!line.startsWith("data:")) continue;

      const payload = line.replace("data:", "").trim();

      if (payload === "[DONE]" || !payload) continue;

      try {
        const parsed = JSON.parse(payload);
        const content = parsed?.choices?.[0]?.delta?.content;

        if (content) {
          aiResponse += content;
        }
      } catch (err) {
        // ignore invalid JSON
      }
    }
  }

  return aiResponse.trim();
};

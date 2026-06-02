import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../configs/database/db.js";

export const chatbotLogs = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);

  const insertQuery = `
    INSERT INTO chatbot_logs
    (conversation_id, method, url, status_code, device, messages, language, class, subject, file_name, response_body, created_at, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const responseChunks: string[] = [];

  // intercept res.write (for streaming)
  const originalWrite = res.write.bind(res);
  res.write = function (chunk: unknown, ...args: unknown[]) {
    responseChunks.push(chunk!.toString());
    return (originalWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  } as typeof res.write;

  res.on("finish", async () => {
    try {
      const now = new Date();

      let messages: unknown = req.body.messages
        ? JSON.parse(req.body.messages)
        : null;
      if (Array.isArray(messages)) {
        messages = messages[messages.length - 1];
      }

      const userId = req.user?.user_id;

      const responseBody = parseSSEChunks(responseChunks);

      const values = [
        req.body.conversation_id || uuidv4(),
        req.method,
        req.originalUrl,
        res.statusCode,
        req.headers["user-agent"],
        JSON.stringify(messages),
        req.body.language ?? null,
        req.body.class ?? null,
        req.body.subject ?? null,
        (req.file as Express.Multer.File | undefined)?.originalname ?? null,
        JSON.stringify(responseBody),
        now,
        userId,
      ];

      await pool.query(insertQuery, values);
    } catch (err) {
      console.error("Logging middleware error:", (err as Error).message);
    }
  });

  next();
};

const parseSSEChunks = (responseChunks: string[]): string => {
  const fullContent = responseChunks.join("");
  let aiResponse = "";
  const lines = fullContent.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;

    const payload = line.replace("data:", "").trim();

    if (payload === "[DONE]" || !payload) continue;

    try {
      const parsed = JSON.parse(payload) as {
        choices?: { delta?: { content?: string } }[];
        content?: string;
      };
      const content =
        parsed?.choices?.[0]?.delta?.content ?? parsed?.content;

      if (content) {
        aiResponse += content;
      }
    } catch {
      // ignore invalid JSON
    }
  }

  return aiResponse.trim();
};
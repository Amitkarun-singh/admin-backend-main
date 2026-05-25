import { v4 as uuidv4 } from "uuid";
import pool from "../configs/database/db.ts";
import type { Request, Response, NextFunction } from "express";

export const tutorLogs = (req: Request, res: Response, next: NextFunction) => {
  console.info("logging");

  let responseBody: any;
  let finalStreamMessage: string | null = null;
   const lang : string | null = req.query?.language  as string;

  const insertQuery = `
    INSERT INTO tutor_logs 
    (conversation_id, method, url, status_code, device, request_body, response_body, created_at , user_details,session_id, user_id,language) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?,?,?,?,?)
  `;

  // ---- Patch res.json ----
  const originalJson = res.json;
  res.json = function (body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  // ---- Patch res.write (SSE handling) ----
  const originalWrite = res.write;
  res.write = function (chunk: any, ...args: any[]) {
    if (chunk) {
      const str = chunk.toString();

      try {
        if (str.startsWith("data:")) {
          const json = JSON.parse(str.replace(/^data:\s*/, ""));

          // ✅ only store final response message
          if (json.type === "final") {
            const copy = { ...json };
            delete copy.audio;
            finalStreamMessage = copy;
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    return (originalWrite as any).call(this, chunk, ...args);
  };

  // ---- On finish ----
  res.on("finish", async () => {
  

    const now = new Date();
    const logUuid = uuidv4();

    // ✅ Extract last message from request
    let lastRequestMessage = null;

    try {
      const messages = JSON.parse(req.body.message || "[]");
      if (Array.isArray(messages) && messages.length > 0) {
        lastRequestMessage = messages[messages.length - 1];
      }
    } catch {
      lastRequestMessage = req.body;
    }

    // ✅ Decide final response
    let finalResponse;

    if (responseBody) {
      finalResponse = JSON.stringify(responseBody);
    } else if (finalStreamMessage) {
      finalResponse = JSON.stringify({
        message: finalStreamMessage,
      });
    } else {
      finalResponse = null;
    }


    const value = [
      logUuid,
      req.method,
      req.originalUrl,
      res.statusCode,
      req.headers["user-agent"],
      JSON.stringify(lastRequestMessage), // ✅ only last req msg
      finalResponse,                      // ✅ only final response msg
      now,
      JSON.stringify(req.user),
      req.body.sessionId,
      req.user?.user_id || null,
      lang
    ];

    

    await pool.query(insertQuery, value);
  });

  next();
};


import { v4 as uuidv4 } from "uuid";
import pool from "../db/db.js";
import type { Request, Response, NextFunction } from "express";
export const tutorLogs = (req: Request, res: Response, next: NextFunction) => {
  console.log("logging");
  const originalJson = res.json;
  let responseBody: { success: string; message: string; errors: string[] };

  const insertQuery = `
  INSERT INTO tutor_logs 
  (conversation_id, method, url, status_code, device, request_body, response_body, created_at , user_details) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?,?)
`;

  res.json = function (body) {
    responseBody = body;
    return originalJson.call(this, body);
  };

  res.on("finish", async () => {
    console.log("logging finish");
    const now = new Date();
    const logUuid = uuidv4();

    const value = [
      logUuid,
      req.method,
      req.originalUrl,
      res.statusCode,
      req.headers["user-agent"],
      JSON.stringify(req.body),
      JSON.stringify(responseBody),
      now,
      JSON.stringify(req.user),
    ];

    await pool.query(insertQuery, value);
  });

  next();
};

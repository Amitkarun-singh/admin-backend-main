import type { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import pool from "../configs/database/db.js";

export const practiceQuestionsLog = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.log("logging");

  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  const insertQuery = `
    INSERT INTO practice_questions_logs 
    (conversation_id, method, url, status_code, device, request_body, response_body, created_at, user_details, user_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  res.json = function (body: unknown) {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
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
      req.user?.user_id,
    ];

    pool
      .query(insertQuery, value)
      .then((results: unknown) => {
        console.log((results as { insertId?: number }).insertId);
      })
      .catch((error: unknown) => {
        if (error instanceof Error) {
          console.error(error.message);
        } else {
          console.error("Failed to insert practice questions log");
        }
      });
  });

  next();
};
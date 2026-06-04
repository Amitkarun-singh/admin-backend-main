import type { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError.ts";
import { ApiError } from "../utils/ApiError.js";
import { StreamAdapter } from "../interface/adapter/StreamAdapter.ts";
const error = new StreamAdapter();
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);

  // ── ApiError (thrown by services/controllers) ─────────────────────────────
  // ApiError uses `statuscode` (lowercase c) and is NOT an AppError instance.
  // Return its message directly so the frontend gets the real validation text.
  if (err instanceof ApiError) {
    return res.status(err.statuscode).json({
      type: "API_ERROR",
      message: err.message,
      errors: err.errors ?? [],
    });
  }

  // ── Unknown errors → wrap as generic 500 ─────────────────────────────────
  if (!(err instanceof AppError)) {
    err = new AppError({
      statusCode: 500,
      type: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    });
  }

  if (err.statusCode === 401) {
    res.set("WWW-Authenticate", 'Bearer realm="api"');
  }

  if (err.statusCode === 429 && err.extra?.retryAfter) {
    res.set("Retry-After", err.extra.retryAfter);
  }

  // 🚨 STREAM HANDLING
  if (
    res.headersSent &&
    res.getHeaders()["content-type"] === "text/event-stream"
  ) {
    res.write(
      error.formatError({
        type: err.type,
        message: err.message,
        ...err.extra,
      }),
    );

    return res.end();
  }

  const response = {
    type: err.type,
    message: err.message,
    ...err.extra,
  };
  res.status(err.statusCode).json(response);
};


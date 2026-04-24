import type { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError.ts";
import { StreamAdapter } from "../ai-features/pattern/adapter/StreamAdapter.ts";
const error = new StreamAdapter();
export const globalErrorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  console.error(err);

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
  console.log("global ", err.extra);
  res.status(err.statusCode).json(response);
};

import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function traceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const traceId = (req.headers["x-trace-id"] as string) || randomUUID();

  req.traceId = traceId; // attach to request
  res.setHeader("x-trace-id", traceId); // optional: send back to client

  next();
}

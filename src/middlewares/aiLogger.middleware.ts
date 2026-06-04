import type { Request, Response, NextFunction, RequestHandler } from "express";
import AiUsageLog from "../models/ai_usage_log.model.ts";

export const aiLogger = (feature: string, action: string): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();

    const originalJson = res.json.bind(res);

    res.json = function (data: unknown) {
      res.locals.responseBody = data;
      return originalJson(data);
    };

    res.on("finish", async () => {
      try {
        const responseTime = Date.now() - start;

        const requestPayload = { body: req.body };

        await AiUsageLog.create({
          user_id: req.user?.user_id ? BigInt(req.user.user_id) : undefined,
          feature: feature as "summarizer" | "ai_notes",
          action,
          endpoint: req.originalUrl,
          request_payload: requestPayload,
          response_data: res.locals.responseBody,
          response_status: res.statusCode,
          response_time_ms: responseTime,
          ip_address: req.ip,
        });
      } catch (err) {
        console.error("AI logging failed:", (err as Error).message);
      }
    });

    next();
  };
};
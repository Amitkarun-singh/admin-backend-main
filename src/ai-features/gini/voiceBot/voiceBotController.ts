import { voiceBotService } from "./voiceBotservice.ts";
import type { Request, Response } from "express";
export const voiceBotController = async (req: Request, res: Response) => {
  const { message } = req.body;
  const file = req.file;

  const msgArr = JSON.parse(message);
  // Set SSE headers (important)
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const response = await voiceBotService(msgArr, file, res);
  // res.status(200).json({ response });
};

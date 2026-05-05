import {
  streamChatbotResponse,
  feedbackThumbUpService,
  feedbackThumbDownService,
} from "./chatbotService.ts";

import type { Request, Response } from "express";
import { ValidationError } from "../../../error/subError.ts";

export const chatbotController = async (req: Request, res: Response) => {
  const errors = [];
  const uploadedFile = req.file;
  console.log("Gini chat bot controller");

  const messagesRaw = req.body.messages;
  const language = req.body.language;
  const className = req.body.class;
  const chapter = req.body.subject;

  if (!messagesRaw) {
    errors.push({
      field: "messages",
      message: "messages must not be empty",
      code: "REQUIRED",
    });
  }

  let messages;
  try {
    messages = JSON.parse(messagesRaw);
  } catch (err: any) {
    errors.push({
      field: "messages",
      message: err.message,
      code: "INVALID_JSON",
    });
  }

  if (!Array.isArray(messages)) {
    errors.push({
      field: "messages",
      message: "messages must be an array",
      code: "ARRAY_REQUIRED",
    });
  }
  if (errors.length) {
    throw new ValidationError(errors);
  }

  // 🔴 REQUIRED FOR STREAMING
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  await streamChatbotResponse(messages, res, uploadedFile, {
    language,
    className,
    chapter,
  });
};

export const feedbackThumbUpController = async (
  req: Request,
  res: Response,
) => {
  // console.log(req.body);

  await feedbackThumbUpService(req.body);
  res.status(200).json({ isSuccessful: true });
};

export const feedbackThumbDownController = async (
  req: Request,
  res: Response,
) => {
  await feedbackThumbDownService(req.body);
  res.status(200).json({ isSuccessful: true });
};

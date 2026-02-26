import { streamChatbotResponse } from "./chatbotService.js";
import multer from "multer";

// Use memory storage for simplicity
const upload = multer({ storage: multer.memoryStorage() });

export const chatbotController = [
  upload.single("file"), // 'file' matches frontend FormData
  async (req, res) => {
    try {
      // Messages come as a JSON string in multipart/form-data
      const messagesRaw = req.body.messages;
      if (!messagesRaw) {
        return res.status(400).json({ error: "Messages array required" });
      }

      let messages;
      try {
        messages = JSON.parse(messagesRaw);
      } catch (err) {
        return res.status(400).json({ error: "Invalid messages JSON" });
      }

      if (!Array.isArray(messages)) {
        return res.status(400).json({ error: "Messages must be an array" });
      }

      // Optional uploaded file
      const uploadedFile = req.file; // multer stores file in req.file

      // console.log("Messages:", messages);
      if (uploadedFile) {
        console.log("Received file:", uploadedFile.originalname);
      }

      // 🔴 REQUIRED FOR STREAMING
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
      res.flushHeaders();

      await streamChatbotResponse(messages, res, uploadedFile);
    } catch (error) {
      console.error("Streaming Controller Error:", error);
      res.write(`data: ${JSON.stringify({ error: "Streaming failed" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  },
];

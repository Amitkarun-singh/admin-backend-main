import {
  streamChatbotResponse,
  feedbackThumbUpService,
  feedbackThumbDownService,
} from "./chatbotService.js";
import multer from "multer";
import { LLMStreamAdapter } from "../../pattern/adapter/LLMStreamAdapter.ts";
// Use memory storage for simplicity
const upload = multer({ storage: multer.memoryStorage() });

export const chatbotController = [
  upload.single("file"), // 'file' matches frontend FormData
  async (req, res) => {
    console.log("Gini chat bot controller");
    try {
      // Messages come as a JSON string in multipart/form-data
      const messagesRaw = req.body.messages;
      const language = req.body.language;
      const className = req.body.class;
      const chapter = req.body.subject;
      if (!messagesRaw) {
        return res.status(400).json({ error: "Messages array required" });
      }

      let messages;
      try {
        messages = JSON.parse(messagesRaw);
      } catch (err) {
        console.log("Gini chat bot controller | Invalid messages JSON");
        return res.status(400).json({ error: "Invalid messages JSON" });
      }

      if (!Array.isArray(messages)) {
        console.log("Gini chat bot controller | Messages must be an array");
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

      await streamChatbotResponse(
        messages,
        res,
        uploadedFile,
        language,
        className,
        chapter,
      );
    } catch (error) {
      console.error("Gini chat bot controller ", error);

      res.write(LLMStreamAdapter.error());
      res.write(LLMStreamAdapter.done());
      res.end();
    }
  },
];

export const feedbackThumbUpController = async (req, res) => {
  // console.log(req.body);
  try {
    await feedbackThumbUpService(req.body);
    res.status(200).json({ isSuccessful: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      isSuccessful: false,
      statusMessage: "something went wrong",
      err,
    });
  }
};
export const feedbackThumbDownController = async (req, res) => {
  try {
    await feedbackThumbDownService(req.body);
    res.status(200).json({ isSuccessful: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      isSuccessful: false,
      statusMessage: "something went wrong",
      err,
    });
  }
};

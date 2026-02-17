import express from "express";
import multer from "multer";
import { summarizeFileOrText } from "../controllers/summarizer.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/",
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.body.ai_feature) {
        return res.status(400).json({ error: "ai_feature is required" });
      }

      let result;

      if (req.file) {
        result = await summarizeFileOrText({
          filePath: req.file.path,
          mimeType: req.file.mimetype,
        });
      } 
      else if (req.body.text) {
        result = await summarizeFileOrText({
          text: req.body.text,
        });
      } 
      else {
        return res.status(400).json({ error: "No file or text provided" });
      }

      res.json({
        summary: result,
        conversation_id: res.locals.conversation_id,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Summarization failed" });
    }
  }
);

export default router;

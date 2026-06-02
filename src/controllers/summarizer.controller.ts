import { Request, Response } from "express";
import { summarizerService } from "../services/summarizer.service.ts";

export class SummarizerController {
  
  async generateSummary(req: Request, res: Response): Promise<void> {
    try {
      const { language, maxlength } = req.body;
      const file = req.file;

      /*
      ------------------------------------------
      Validate Inputs
      ------------------------------------------
      */

      if (!language) {
        res.status(400).json({
          success: false,
          message: "language is required",
        });
        return;
      }

      if (!file) {
        res.status(400).json({
          success: false,
          message: "file is required",
        });
        return;
      }

      /*
      ------------------------------------------
      Generate Summary
      ------------------------------------------
      */

      const result = await summarizerService.generateSummary({
        language,
        maxlength: maxlength ? Number(maxlength) : undefined,
        filePath: file.path,
        mimeType: file.mimetype,
        originalname: file.originalname,
      });

      /*
      ------------------------------------------
      Send Response
      ------------------------------------------
      */

      res.status(200).json({
        success: true,
        message: "Summary generated successfully",
        file: result.file,
        summary: result.summary,
      });

    } catch (error: any) {
      console.error("Generate Summary Error:", error);

      res.status(500).json({
        success: false,
        message: error.message || "Failed to generate summary",
      });
    }
  }
}

export const summarizerController = new SummarizerController();
export const generateSummary = summarizerController.generateSummary.bind(summarizerController);
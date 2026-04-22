import { string } from "zod";
import {
  getPapers,
  getFilePreviewUrl,
  getFileDownloadUrl,
  getClasses,
  getSubjects,
} from "./predictPapers.service.js";

import type { Request, Response } from "express";

export const fetchPaper = async (req: Request, res: Response) => {
  try {
    const { board, className, subject } = req.query as {
      board: string;
      className: string;
      subject: string;
    };

    if (!board || !className || !subject) {
      return res.status(400).json({
        message: "board, year, className and subject are required",
      });
    }

    const papers = await getPapers({ board, className, subject });

    if (!papers || papers.length === 0) {
      return res.status(404).json({ message: "Paper not found" });
    }

    res.json(papers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const previewPaper = async (req: Request, res: Response) => {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "filePath query param is required" });
  }

  try {
    const result = await getFilePreviewUrl(filePath as string);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Preview URL generation failed:", err);
    return res.status(500).json({ error: "Failed to generate preview URL" });
  }
};

export const downloadPaper = async (req: Request, res: Response) => {
  const { filePath, fileName } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "filePath query param is required" });
  }

  try {
    const result = await getFileDownloadUrl(
      filePath as string,
      fileName as string,
    );
    return res.status(200).json(result);
  } catch (err) {
    console.error("Download URL generation failed:", err);
    return res.status(500).json({ error: "Failed to generate download URL" });
  }
};

export const getSubjectsController = async (req: Request, res: Response) => {
  const board = req.query.board as string;
  const className = req.query.className as string;

  if (!board || !className) {
    return res
      .status(400)
      .json({ error: "board, year and className are required" });
  }

  try {
    const result = await getSubjects({ board, className });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Failed to fetch subjects:", err);
    return res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

export const getClassesController = async (req: Request, res: Response) => {
  const { board } = req.query as { board: string };

  if (!board) {
    return res
      .status(400)
      .json({ error: "board, year and className are required" });
  }

  try {
    const result = await getClasses({ board });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Failed to fetch subjects:", err);
    return res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

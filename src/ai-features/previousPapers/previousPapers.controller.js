import {
  getPapers,
  getFilePreviewUrl,
  getFileDownloadUrl,
  getYears,
  getSubjects,
  getClasses,
} from "./previousPapers.service.js";

export const fetchPaper = async (req, res) => {
  try {
    const { board, year, className, subject } = req.query;

    if (!board || !year || !className || !subject) {
      return res.status(400).json({
        message: "board, year, className and subject are required",
      });
    }

    const papers = await getPapers({ board, year, className, subject });

    if (!papers || papers.length === 0) {
      return res.status(404).json({ message: "Paper not found" });
    }

    res.json(papers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const previewPaper = async (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "filePath query param is required" });
  }

  try {
    const result = await getFilePreviewUrl(filePath);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Preview URL generation failed:", err);
    return res.status(500).json({ error: "Failed to generate preview URL" });
  }
};

export const downloadPaper = async (req, res) => {
  const { filePath, fileName } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: "filePath query param is required" });
  }

  try {
    const result = await getFileDownloadUrl(filePath, fileName);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Download URL generation failed:", err);
    return res.status(500).json({ error: "Failed to generate download URL" });
  }
};

export const getYearsController = async (req, res) => {
  const { board } = req.query;

  if (!board) {
    return res.status(400).json({ error: "board query param is required" });
  }

  try {
    const result = await getYears({ board });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Failed to fetch years:", err);
    return res.status(500).json({ error: "Failed to fetch years" });
  }
};

export const getSubjectsController = async (req, res) => {
  const { board, year, className } = req.query;

  if (!board || !year || !className) {
    return res
      .status(400)
      .json({ error: "board, year and className are required" });
  }

  try {
    const result = await getSubjects({ board, year, className });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Failed to fetch subjects:", err);
    return res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

export const getClassesController = async (req, res) => {
  const { board, year } = req.query;

  if (!board || !year) {
    return res
      .status(400)
      .json({ error: "board, year and className are required" });
  }

  try {
    const result = await getClasses({ board, year });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Failed to fetch subjects:", err);
    return res.status(500).json({ error: "Failed to fetch subjects" });
  }
};

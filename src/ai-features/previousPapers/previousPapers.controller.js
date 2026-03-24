import {
  getPapers,
  getFilePreviewUrl,
  getFileDownloadUrl,
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

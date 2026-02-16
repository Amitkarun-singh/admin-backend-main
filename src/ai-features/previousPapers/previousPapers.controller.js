import { getPapers } from "./previousPapers.service.js";

export const fetchPaper = (req, res) => {
  try {
    const { board, year, className, subject } = req.query;

    if (!board || !year || !className || !subject) {
      return res.status(400).json({
        message: "board, year, className and subject are required",
      });
    }

    const papers = getPapers({ board, year, className, subject });

    if (!papers || papers.length === 0) {
      return res.status(404).json({ message: "Paper not found" });
    }

    res.json(papers);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

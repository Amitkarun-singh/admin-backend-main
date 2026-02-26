import express from "express";
import { fetchPaper } from "./previousPapers.controller.js";
import path from "path";

const router = express.Router();
router.use("/predict", express.static("predict"));

router.get("/papers", fetchPaper); // get specific paper

// Download route
router.get("/papers/download", (req, res) => {
  const { filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ message: "filePath required" });
  }

  if (filePath.includes("..")) {
    return res.status(400).json({ message: "Invalid file path" });
  }

  const fullPath = path.join(process.cwd(), filePath);

  console.log("Downloading:", fullPath);

  res.download(fullPath, (err) => {
    if (err) {
      console.error(err);
      res.status(404).json({ message: "File not found" });
    }
  });
});

export default router;

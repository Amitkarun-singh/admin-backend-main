import express from "express";
import {
  fetchPaper,
  previewPaper,
  downloadPaper,
} from "./previousPapers.controller.js";
import path from "path";

const router = express.Router();

router.get("/papers", fetchPaper);
router.get("/papers/preview", previewPaper);
router.get("/papers/download", downloadPaper);

export default router;

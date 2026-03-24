import express from "express";
import {
  fetchPaper,
  previewPaper,
  downloadPaper,
} from "./predictPapers.controller.js";

const router = express.Router();

router.get("/papers", fetchPaper);
router.get("/papers/preview", previewPaper);
router.get("/papers/download", downloadPaper);

export default router;

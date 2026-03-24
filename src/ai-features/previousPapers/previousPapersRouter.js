import express from "express";
import {
  fetchPaper,
  previewPaper,
  downloadPaper,
  getYearsController,
  getSubjectsController,
  getClassesController,
} from "./previousPapers.controller.js";

const router = express.Router();

router.get("/papers", fetchPaper);
router.get("/papers/preview", previewPaper);
router.get("/papers/download", downloadPaper);
router.get("/papers/years", getYearsController);
router.get("/papers/subject", getSubjectsController);
router.get("/papers/classes", getClassesController);

export default router;

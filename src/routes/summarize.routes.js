import express from "express";
import { upload }           from "../middlewares/multer.middleware.js";
import { generateSummary }  from "../controllers/summarizer.controller.js";
import { aiLogger }         from "../middlewares/aiLogger.middleware.js";
import { authMiddleware }   from "../middlewares/auth.middleware.js";
import { requireFeature }   from "../middlewares/feature.middleware.js";
import { activityMiddleware } from "../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

// Feature ID 18 = DOC_SUMMARISER
router.post(
  "/summarize",
  authMiddleware,
  requireFeature(18),
  aiLogger("summarizer", "generate_summary"),
  upload.single("file"),
  generateSummary
);

export default router;
import express from "express";
const router = express.Router();
import { appFeedbackController } from "./appFeedbackController.js";

router.post("/", appFeedbackController);

export default router;

import express from "express";
const router = express.Router();
import { appFeedbackController } from "../../controllers/appFeedback.controller.ts";

router.post("/", appFeedbackController);

export default router;

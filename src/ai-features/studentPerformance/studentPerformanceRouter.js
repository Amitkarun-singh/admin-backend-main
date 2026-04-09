import express from "express";
import { getDashboard } from "../studentPerformance/studentPerformance.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/performance/:studentId", authMiddleware, getDashboard);

export default router;

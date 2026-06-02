import express from "express";
import { getDashboard } from "../../controllers/studentPerformance.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.ts";
const router = express.Router();

router.get("/performance/:studentId", authMiddleware, getDashboard);

export default router;

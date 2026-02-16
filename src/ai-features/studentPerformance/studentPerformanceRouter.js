import express from "express";
import { getDashboard } from "../studentPerformance/studentPerformance.controller.js";
const router = express.Router();

router.get("/performance/:studentId", getDashboard);

export default router;

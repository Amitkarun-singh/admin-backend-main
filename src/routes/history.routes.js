import express from "express";
import {
  getRecentQueries,
  getFeaturesExplored,
  getLoginHistory,
  getWeekActivity,
  getStats,
  getConversation,
  getLatestTests,          // ← added
} from "../controllers/history.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/recent-queries",              authMiddleware, getRecentQueries);
router.get("/features-explored",           authMiddleware, getFeaturesExplored);
router.get("/login-history",               authMiddleware, getLoginHistory);
router.get("/week-activity",               authMiddleware, getWeekActivity);
router.get("/stats",                       authMiddleware, getStats);
router.get("/latest-tests",                authMiddleware, getLatestTests);   // ← added

// Fetch full conversation — called when user clicks a recent query card
// ?source=gini
router.get("/conversation/:conversation_id", authMiddleware, getConversation);

export default router;
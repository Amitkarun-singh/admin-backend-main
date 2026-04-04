import express from "express";
import {
  getRecentQueries,
  getFeaturesExplored,
  getLoginHistory,
  getWeekActivity,
  getStats,
  getConversation,
} from "../controllers/history.controller.js";

import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/recent-queries",              authMiddleware, getRecentQueries);
router.get("/features-explored",           authMiddleware, getFeaturesExplored);
router.get("/login-history",               authMiddleware, getLoginHistory);
router.get("/week-activity",               authMiddleware, getWeekActivity);
router.get("/stats",                       authMiddleware, getStats);

// Fetch full conversation — called when user clicks a recent query card
// ?source=gini  OR  ?source=practice
router.get("/conversation/:conversation_id", authMiddleware, getConversation);

export default router;
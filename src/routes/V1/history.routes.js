import express from "express";
import {
  getRecentQueries,
  getFeaturesExplored,
  getLoginHistory,
  getWeekActivity,
  getStats,
  getConversation,
  getLatestTests,
} from "../../controllers/history.controller.js";

import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { activityMiddleware } from "../../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

router.get("/recent-queries",    authMiddleware, getRecentQueries);
router.get("/features-explored", authMiddleware, getFeaturesExplored);
router.get("/login-history",     authMiddleware, getLoginHistory);
router.get("/week-activity",     authMiddleware, getWeekActivity);
router.get("/stats",             authMiddleware, getStats);
router.get("/latest-tests",      authMiddleware, getLatestTests);

// Fetch full conversation — called when user clicks a history card
// ?source=gini     → chatbot_logs
// ?source=tutor    → tutor_logs   ← NEW
// ?source=practice → practice_logs
router.get("/conversation/:conversation_id", authMiddleware, getConversation);

export default router;
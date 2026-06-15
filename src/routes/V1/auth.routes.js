import express from "express";
import {
  login,
  selectAccount,
  getLinkedAccounts,
  switchAccount,
  resetFirstTimePassword,
  verifyIdToken,
  resetPassword,
  logout,
  refreshAccessToken,
} from "../../controllers/auth.controller.ts";
import { authMiddleware } from "../../middlewares/auth.middleware.ts";
import { activityMiddleware } from "../../middlewares/activity.middleware.ts";

const router = express.Router();
router.use(activityMiddleware);

// ── Public ─────────────────────────────────────────────────────────────────────
router.post("/login", login);

// Step 2 of phone login when multiple accounts share the same number
router.post("/select-account", selectAccount);

router.post("/refresh-token", refreshAccessToken);

// First-time password reset (uses short-lived tempToken, not a session JWT)
router.post("/reset-first-time-password", resetFirstTimePassword);

// Forgot password — step 1: verify Firebase OTP
router.post("/verify-id-token", verifyIdToken);
// Forgot password — step 2: submit new password
router.post("/forgot-password/reset", resetPassword);

// ── Protected (valid session JWT required) ──────────────────────────────────
router.post("/logout", authMiddleware, logout);

// Account switcher — list all accounts on same phone, then switch
router.get("/accounts",       authMiddleware, getLinkedAccounts);
router.post("/switch-account", authMiddleware, switchAccount);

export default router;
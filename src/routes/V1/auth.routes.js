import express from "express";
import {
  login,
  //sendLoginOtp,
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
// ── Public ───────────────────────────────────────────────────────────────
router.post("/login", login);
// router.post("/login/send-otp", sendLoginOtp);
router.post("/refresh-token", refreshAccessToken);

// ── First-time password reset (uses tempToken, no authMiddleware) ─────────
router.post("/reset-first-time-password", resetFirstTimePassword);

// ── Forgot password (3-step flow, all public) ────────────────────────────
//
//  Step 1 — enter phone number → receive otpToken
router.post("/verify-id-token", verifyIdToken);
//
//  Step 2 — submit phone_number + otp + otpToken → receive resetToken
// router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
//
//  Step 3 — submit resetToken (Authorization header) + new password
router.post("/forgot-password/reset", resetPassword);

// ── Protected ─────────────────────────────────────────────────────────────

router.post("/logout", authMiddleware, logout);

export default router;
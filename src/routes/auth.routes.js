import express from "express";
import {
  login,
  sendLoginOtp,
  resetFirstTimePassword,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  getLoggedInUserProfile,
  logout,
  refreshAccessToken,
  updateAvatar
} from "../controllers/auth.controller.ts";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { getUserProfile } from "../controllers/profile.controller.js";
import { activityMiddleware } from "../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);
// ── Public ───────────────────────────────────────────────────────────────
router.post("/login", login);
router.post("/login/send-otp", sendLoginOtp);
router.post("/refresh-token", refreshAccessToken);

// ── First-time password reset (uses tempToken, no authMiddleware) ─────────
router.post("/reset-first-time-password", resetFirstTimePassword);

// ── Forgot password (3-step flow, all public) ────────────────────────────
//
//  Step 1 — enter phone number → receive otpToken
router.post("/forgot-password", forgotPasswordSendOtp);
//
//  Step 2 — submit phone_number + otp + otpToken → receive resetToken
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
//
//  Step 3 — submit resetToken (Authorization header) + new password
router.post("/forgot-password/reset", forgotPasswordReset);

// ── Protected ─────────────────────────────────────────────────────────────
router.post("/update-avatar", upload.single("file"), authMiddleware, updateAvatar);
router.get("/profile", authMiddleware, getLoggedInUserProfile);
router.post("/logout", authMiddleware, logout);

export default router;
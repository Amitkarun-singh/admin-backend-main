import express from "express";
import {
  login,
  sendLoginOtp,
  resetFirstTimePassword,
  getLoggedInUserProfile,
  logout,
  refreshAccessToken,
  updateAvatar
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = express.Router();

// ── Public ──────────────────────────────────────────────────
router.post("/login",          login);
router.post("/login/send-otp", sendLoginOtp);
router.post("/refresh-token",  refreshAccessToken);

// ── First-time password reset ────────────────────────────────
// No authMiddleware here — uses the short-lived tempToken in the
// Authorization header (issued by /login when is_password_reset_required = true)
router.post("/reset-first-time-password", resetFirstTimePassword);

// ── Protected ────────────────────────────────────────────────
router.post("/update-avatar", upload.single("file"), authMiddleware, updateAvatar);
router.get( "/profile",       authMiddleware, getLoggedInUserProfile);
router.post("/logout",        authMiddleware, logout);

export default router;
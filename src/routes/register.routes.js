/* =====================================================
   src/routes/register.routes.js
   Mount in src/index.js:
     app.use("/api/auth/register", registerRoutes);
   ===================================================== */
import express from "express";
import {
  register,
  resendOtp,
  verifyRegistrationOtp,
  getOnboardingData,
  completeProfile,
} from "../controllers/register.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

/* ── PUBLIC ─────────────────────────────────────────── */
router.post("/",            register);           // Step 1
router.post("/resend-otp",  resendOtp);          // Step 2a
router.post("/verify-otp",  verifyRegistrationOtp); // Step 2b

/* ── AUTHENTICATED ──────────────────────────────────── */
router.get( "/onboarding",       authMiddleware, getOnboardingData);  // Step 3
router.post("/complete-profile", authMiddleware, completeProfile);    // Step 4

export default router;
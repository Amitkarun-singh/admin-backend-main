/* =====================================================
   src/routes/register.routes.js
   Mount in src/index.js:
     app.use("/api/auth/register", registerRoutes);
   ===================================================== */
import express from "express";
import {
  register,
  selfRegister,
  resendOtp,
  verifyRegistrationOtp,
  getOnboardingData,
  completeProfile,
  getClasses,
  getStream,
  verifyUsername,
  verifyPhoneNumber
} from "../../controllers/register.controller.js";
import { authMiddleware } from "../../middlewares/auth.middleware.js";
import { activityMiddleware } from "../../middlewares/activity.middleware.js";

const router = express.Router();
router.use(activityMiddleware);

/* ── PUBLIC ─────────────────────────────────────────── */
// router.post("/", register);           // Step 1
router.post("/", selfRegister);
router.post("/resend-otp", resendOtp);          // Step 2a                                          
router.post("/verify-otp", verifyRegistrationOtp); // Step 2b
router.get("/classes", getClasses)
router.get("/stream", getStream)
router.post("/exist/username", verifyUsername)
router.post("/exist/phone-number", verifyPhoneNumber)

/* ── AUTHENTICATED ──────────────────────────────────── */
router.get("/onboarding", authMiddleware, getOnboardingData);  // Step 3
router.post("/complete-profile", authMiddleware, completeProfile);    // Step 4

export default router;
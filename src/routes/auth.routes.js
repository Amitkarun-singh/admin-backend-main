import express from "express";
import {
    login,
    sendLoginOtp,
    getLoggedInUserProfile,
    logout
} from "../controllers/auth.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/login", login);
router.post("/login/send-otp", sendLoginOtp);

router.get(
    "/profile",
    authMiddleware,
    getLoggedInUserProfile
);

router.post(
    "/logout",
    authMiddleware,
    logout
);

export default router;

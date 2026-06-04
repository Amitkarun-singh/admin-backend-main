import express from "express";
import { upload } from "../../middlewares/multer.middleware.ts";
import { getUserProfile, updateAvatar } from "../../controllers/profile.controller.ts";
import { authMiddleware } from "../../middlewares/auth.middleware.ts";
const router = express.Router();


router.post("/update-avatar", upload.single("file"), authMiddleware, updateAvatar);
router.get("/profile", authMiddleware, getUserProfile);

export default router
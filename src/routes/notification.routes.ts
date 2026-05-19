import Express from "express";
import { notificationRegister } from "../controllers/notification.controller.ts"
import { authMiddleware } from "../middlewares/auth.middleware.ts"
const router = Express.Router()
router.post("/register", authMiddleware, notificationRegister)
export default router
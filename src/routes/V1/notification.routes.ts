import Express from "express";
import { notificationRegister, notificationSend, notificationTopicSend, notificationTopicUnsubscribe, notificationTopicSubscribe } from "../../controllers/notification.controller.ts"
import { authMiddleware } from "../../middlewares/auth.middleware.ts"
const router = Express.Router()
router.post("/register", authMiddleware, notificationRegister)
router.post("/send", authMiddleware, notificationSend)
router.post("/topic-send", authMiddleware, notificationTopicSend)
router.post("/topic-unsubscribe", authMiddleware, notificationTopicUnsubscribe)
router.post("/topic-subscribe", authMiddleware, notificationTopicSubscribe)
export default router
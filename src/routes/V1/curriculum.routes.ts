import express from "express"
import {classes, subject,stream,chapter} from "../../controllers/curriculum.controller.ts"
import { authMiddleware } from "../../middlewares/auth.middleware.ts"
const router = express.Router()

router.get("/class",authMiddleware,classes)
router.get("/class/:classId/subject",authMiddleware,subject)
router.get("/stream",authMiddleware,stream)
router.get("/class/:classId/subject/:subjectId/chapter",authMiddleware,chapter)

export default router
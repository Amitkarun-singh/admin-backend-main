import express from "express"
import { classes, subject, stream, chapter,section } from "../../controllers/curriculum.controller.js"
import { authMiddleware } from "../../middlewares/auth.middleware.js"

const router = express.Router()

// ─── Existing controller-backed routes ────────────────────────────────────────
//get classes
router.get("/class", authMiddleware, classes)
//get subject
router.get("/class/:classId/subject", authMiddleware, subject)
//get stream
router.get("/stream", authMiddleware, stream)
//get chapter
router.get("/class/:classId/subject/:subjectId/chapter", authMiddleware, chapter)
//get section
router.get("section",authMiddleware, section)

export default router
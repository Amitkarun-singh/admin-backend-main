import express from "express"
import {classes, subject,stream,chapter} from "../../controllers/curriculum.controller.ts"

const router = express.Router()

router.get("/class",classes)
router.get("/class/:classId/subject",subject)
router.get("/stream",stream)
router.get("/class/:classId/subject/:subjectId/chapter",chapter)

export default router
import express from "express"
import {classes, subject} from "../../controllers/curriculum.controller.ts"
const router = express.Router()

router.get("/class",classes)
router.get("/class/:classId/subject",subject)
// router.get("/stream")
// router.get("class/:classId/subject/subjectId/chapter")

export default router
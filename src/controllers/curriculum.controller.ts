import type { Request, Response } from "express"
import CurriculumService from "../services/curriculum.service.ts"

import AiNote from "../models/ainote_new.model.ts"

export async function classes(req: Request, res: Response) {
  const role = req?.user?.role
  const userId = String(req?.user?.user_id)
  const schoolId = String(req?.user?.school_id)
<<<<<<< HEAD
  const type = String(req?.query?.type)
=======
>>>>>>> 5b90bef3527b441845b2ef62c2b0135631d6c029


  if (role.toLowerCase() === "student") {
    const data = await CurriculumService.onlyAsignClass(userId, schoolId);
    return res.status(200).json(data);
<<<<<<< HEAD
  } else if (type.toLowerCase() === "ai-notes") {
    const data = await CurriculumService.onlyAiNotesClass(AiNote)
    return res.status(200).json(data);
=======
>>>>>>> 5b90bef3527b441845b2ef62c2b0135631d6c029
  } else {
    const data = await CurriculumService.allClass();
    return res.status(200).json(data);
  }
}

export async function subject(req: Request, res: Response) {
  const role = req?.user?.role
  const userId = String(req?.user?.user_id)
  const schoolId = String(req?.user?.school_id)
  const classId = String(req.params.classId);
  const board = String(req.query.board ?? "")
  const streamId = String(req.query.streamId ?? "")


  if (role.toLowerCase() === "student") {
    const data = await CurriculumService.onlyAsignSubject(classId, board, streamId, userId, schoolId);
    return res.status(200).json(data);
  } else {
    const data = await CurriculumService.allSubject(classId, board, streamId);
    return res.status(200).json(data);
  }

}

export async function stream(req: Request, res: Response) {
  const data = await CurriculumService.stream();
  return res.status(200).json(data);

}

export async function chapter(req: Request, res: Response) {
  const role = req?.user?.role
  const userId = String(req?.user?.user_id)
  const schoolId = String(req?.user?.school_id)
  const classId = String(req.params.classId);
  const subjectId = String(req.params.subjectId);
  const board = String(req.query.board ?? "")
  const streamId = String(req.query.streamId ?? "")
  const lang = String(req.query.lang ?? "")

  if (role.toLowerCase() === "student") {
    const data = await CurriculumService.onlyAsignChapter({ classId, board, streamId, userId, schoolId, subjectId, lang });
    return res.status(200).json(data);
  } else {
    const data = await CurriculumService.allChapter({ classId, board, streamId, subjectId, lang });
    return res.status(200).json(data);
  }

}


import type {Request, Response} from "express"
import CurriculumService from "../services/curriculum.service.ts"

export async function classes(req: Request, res: Response) {
  const role = req.user.role || "student";
  const userId = req.user.userId || 118;
  const schoolId = req.user.schoolId || 22;

  if (role === "student") {
      const data = await CurriculumService.onlyAsignClass(userId, schoolId);
      return res.status(200).json(data);
    } else {
      const data = await CurriculumService.allClass();
    return res.status(200).json(data);
  }
}

export async function subject(req :Request,res:Response) {
     const role = req.user.role || "students";
  const userId = req.user.userId || 118;
  const schoolId = req.user.schoolId || 22;
  const classId = req.params.classId;
  const board = req.query.board
  const streamId = req.query.streamId

  if (role === "student") {
      const data = await CurriculumService.onlyAsignSubject(classId,board,streamId,userId,schoolId);
      return res.status(200).json(data);
    } else {
      const data = await CurriculumService.allSubject(classId,board,streamId);
    return res.status(200).json(data);
  }
    
}

export function stream(req :Request,res:Response) {
    
}

export function chapter(req :Request,res:Response) {
    
}
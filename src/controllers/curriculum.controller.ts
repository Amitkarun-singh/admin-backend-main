import type {Request, Response} from "express"
import CurriculumService from "../services/curriculum.service.ts"

export async function classes(req: Request, res: Response) {
      const role = req?.user?.role 
  const userId = req?.user?.user_id 
  const schoolId = req?.user?.school_id 
  

  if (role.toLowerCase() === "student") {
      const data = await CurriculumService.onlyAsignClass(userId, schoolId);
      return res.status(200).json(data);
    } else {
      const data = await CurriculumService.allClass();
    return res.status(200).json(data);
  }
}

export async function subject(req :Request,res:Response) {
   const role = req?.user?.role 
  const userId = req?.user?.user_id 
  const schoolId = req?.user?.school_id 
  const classId = req.params.classId;
  const board = req.query.board
  const streamId = req.query.streamId

  if (role.toLowerCase() === "student") {
      const data = await CurriculumService.onlyAsignSubject(classId,board,streamId,userId,schoolId);
      return res.status(200).json(data);
    } else {
      const data = await CurriculumService.allSubject(classId,board,streamId);
    return res.status(200).json(data);
  }
    
}

export async function stream(req :Request,res:Response) {
   const data = await CurriculumService.stream();
    return res.status(200).json(data);
    
}

export async function chapter(req :Request,res:Response) {
     const role = req?.user?.role 
  const userId = req?.user?.user_id 
  const schoolId = req?.user?.school_id 
  const classId = req.params.classId;
  const subjectId = req.params.subjectId;
  const board = req.query.board
  const streamId = req.query.streamId
  const lang = req.query.lang

  if (role.toLowerCase() === "student") {
      const data = await CurriculumService.onlyAsignChapter({classId,board,streamId,userId,schoolId, subjectId,lang});
      return res.status(200).json(data);
    } else {
      const data = await CurriculumService.allChapter({classId,board,streamId,subjectId,lang});
    return res.status(200).json(data);
  }
    
}


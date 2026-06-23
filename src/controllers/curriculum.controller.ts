import { Request, Response } from "express";
import curriculumService from "../services/curriculum.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(res: Response, err: any) {
  if (err instanceof ApiError) {
    return res
      .status(err.statuscode)
      .json(new ApiResponse(err.statuscode, null, err.message));
  }
  console.error("[CurriculumController]", err);
  return res.status(502).json(new ApiResponse(502, null, "Curriculum service error"));
}

// ─── Read: full catalogue ─────────────────────────────────────────────────────

export const classes = async (req: Request, res: Response) => {
  try {
    const data = await curriculumService.allClass();
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const subject = async (req: Request, res: Response) => {
  try {
    const classId = String(req.params.classId);
    const board = String(req.query.board ?? "");
    const streamId = req.query.streamId !== undefined ? String(req.query.streamId) : 4;
    const data = await curriculumService.allSubject(
      classId,
      board,
      streamId,
    );
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const stream = async (req: Request, res: Response) => {
  try {
    const data = await curriculumService.stream();
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const section = async (req: Request, res: Response) => {
  try {
    const data = await curriculumService.section();
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const chapter = async (req: Request, res: Response) => {
  try {
    const classId = String(req.params.classId);
    const subjectId = String(req.params.subjectId);
    const board = String(req.query.board ?? "");
    const streamId = req.query.streamId !== undefined ? String(req.query.streamId) : 4;
    const lang = req.query.lang !== undefined ? String(req.query.lang) : "English";
    const data = await curriculumService.allChapter({
      classId,
      board,
      streamId,
      subjectId,
      lang,
    });
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

// ─── Read: assigned resources (student view) ──────────────────────────────────

export const assignedClasses = async (req: Request, res: Response) => {
  try {
    const { userId, schoolId } = req.query;
    if (!userId || !schoolId)
      return res
        .status(400)
        .json(new ApiResponse(400, null, "userId and schoolId are required"));
    const data = await curriculumService.onlyAsignClass(
      userId as string,
      schoolId as string,
    );
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const assignedSubjects = async (req: Request, res: Response) => {
  try {
    const classId = String(req.params.classId);
    const { board, streamId, userId, schoolId } = req.query;
    if (!board || !streamId || !userId || !schoolId)
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "board, streamId, userId and schoolId are required"),
        );
    const data = await curriculumService.onlyAsignSubject(
      classId,
      String(board),
      String(streamId),
      String(userId),
      String(schoolId),
    );
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const assignedChapters = async (req: Request, res: Response) => {
  try {
    const classId = String(req.params.classId);
    const subjectId = String(req.params.subjectId);
    const { board, streamId, userId, schoolId, lang } = req.query;
    if (!board || !streamId || !userId || !schoolId)
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "board, streamId, userId and schoolId are required"),
        );
    const data = await curriculumService.onlyAsignChapter({
      classId,
      board: String(board),
      streamId: String(streamId),
      userId: String(userId),
      schoolId: String(schoolId),
      subjectId,
      lang: lang !== undefined ? String(lang) : "English",
    });
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

// ─── Write: class assignment ──────────────────────────────────────────────────

export const assignClassProxy = async (req: Request, res: Response) => {
  try {
    const { userId, schoolId, classId, streamId, sectionId } = req.body;
    if (!userId || !schoolId || !classId || !streamId || !sectionId)
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "userId, schoolId, classId, streamId and sectionId are required",
          ),
        );
    const data = await curriculumService.assignClass({
      userId,
      schoolId,
      classId,
      streamId,
      sectionId,
    });
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const removeClassProxy = async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId)
      return res
        .status(400)
        .json(new ApiResponse(400, null, "userId is required"));
    const data = await curriculumService.removeAsignClass(userId);
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

// ─── Write: subject CRUD ──────────────────────────────────────────────────────

export const createSubjectProxy = async (req: Request, res: Response) => {
  try {
    const { subjectName, board, streamId, classIds } = req.body;
    if (!subjectName || !board || !streamId || !classIds?.length)
      return res
        .status(400)
        .json(
          new ApiResponse(
            400,
            null,
            "subjectName, board, streamId and classIds are required",
          ),
        );
    const data = await curriculumService.createSubject({
      subjectName,
      board,
      streamId,
      classIds,
    });
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const deleteSubjectProxy = async (req: Request, res: Response) => {
  try {
    const { subjectId } = req.params;
    const data = await curriculumService.deleteSubject(String(subjectId));
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

// ─── Write: chapter CRUD ──────────────────────────────────────────────────────

export const createChapterProxy = async (req: Request, res: Response) => {
  try {
    const { name, subjectId, language } = req.body;
    if (!name || !subjectId || !language)
      return res
        .status(400)
        .json(
          new ApiResponse(400, null, "name, subjectId and language are required"),
        );
    const data = await curriculumService.createChapter({ name, subjectId, language });
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const deleteChapterProxy = async (req: Request, res: Response) => {
  try {
    const { chapterId } = req.params;
    const data = await curriculumService.deleteChapter(String(chapterId));
    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

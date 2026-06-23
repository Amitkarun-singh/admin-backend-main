import { Request, Response } from "express";
import curriculumService from "../services/curriculum.service.js";
import AiNote from "../models/ainote_new.model.ts";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handleError(res: Response, err: unknown) {
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
    const role = req?.user?.role ?? "";
    const userId = String(req?.user?.user_id ?? "");
    const schoolId = String(req?.user?.school_id ?? "");
    const type = String(req?.query?.type ?? "");

    let data: unknown;

    if (role.toLowerCase() === "student") {
      data = await curriculumService.onlyAsignClass(userId, schoolId);
    } else if (type.toLowerCase() === "ai-notes") {
      data = await curriculumService.onlyAiNotesClass(AiNote);
    } else {
      data = await curriculumService.allClass();
    }

    res.json(new ApiResponse(200, data));
  } catch (err) {
    handleError(res, err);
  }
};

export const subject = async (req: Request, res: Response) => {
  try {
    const role = req?.user?.role ?? "";
    const userId = String(req?.user?.user_id ?? "");
    const schoolId = String(req?.user?.school_id ?? "");
    const classId = String(req.params.classId);
    const board = String(req.query.board ?? "");
    const streamId =
      req.query.streamId !== undefined ? String(req.query.streamId) : 4;

    let data: unknown;

    if (role.toLowerCase() === "student") {
      data = await curriculumService.onlyAsignSubject(
        classId,
        board,
        String(streamId),
        userId,
        schoolId,
      );
    } else {
      data = await curriculumService.allSubject(classId, board, streamId);
    }

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

/**
 * GET /api/v1/curriculum/section
 *
 * Returns every section with **both** `id` and `section_id` fields populated
 * so consumers can rely on either property without type-unsafe look-ups.
 *
 * Raw curriculum service may return items where only one of the two keys
 * exists (e.g. `{ id: 3, section_name: "A" }` or
 *              `{ section_id: 3, section_name: "A" }`).
 * We normalise here so the response is always consistent.
 */
export const section = async (req: Request, res: Response) => {
  try {
    const raw = await curriculumService.section();

    // raw may be { success, data: [...] } or directly an array
    const rawArray: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data)
        ? raw.data
        : [];

    const normalized = rawArray.map((item: unknown) => {
      const s = item as Record<string, unknown>;
      const resolvedId = Number(s.section_id ?? s.id ?? 0);
      return {
        ...s,
        id: resolvedId,
        section_id: resolvedId,
        section_name: String(s.section_name ?? s.name ?? ""),
      };
    });

    res.json(new ApiResponse(200, normalized));
  } catch (err) {
    handleError(res, err);
  }
};

export const chapter = async (req: Request, res: Response) => {
  try {
    const role = req?.user?.role ?? "";
    const userId = String(req?.user?.user_id ?? "");
    const schoolId = String(req?.user?.school_id ?? "");
    const classId = String(req.params.classId);
    const subjectId = String(req.params.subjectId);
    const board = String(req.query.board ?? "");
    const streamId =
      req.query.streamId !== undefined ? String(req.query.streamId) : 4;
    const lang =
      req.query.lang !== undefined ? String(req.query.lang) : "English";

    let data: unknown;

    if (role.toLowerCase() === "student") {
      data = await curriculumService.onlyAsignChapter({
        classId,
        board,
        streamId: String(streamId),
        userId,
        schoolId,
        subjectId,
        lang,
      });
    } else {
      data = await curriculumService.allChapter({
        classId,
        board,
        streamId,
        subjectId,
        lang,
      });
    }

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
        .json(new ApiResponse(400, null, "name, subjectId and language are required"));
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

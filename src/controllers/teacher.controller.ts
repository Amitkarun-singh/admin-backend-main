import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { teacherService } from "../services/teacher.service.js";

export const createTeacher = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const { teacher, secondarySubjects } = await teacherService.createTeacher({ ...req.body, school_id });
  return res.status(201).json(
    new ApiResponse(201, { ...(teacher as any).toJSON?.() ?? teacher, secondarySubjects }, "Teacher created successfully")
  );
});

export const bulkTeacherUpload = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const file = (req as any).file;

  if (!file) throw new ApiError(400, "Excel file required");

  const result = await teacherService.bulkTeacherUpload(file.path, school_id);
  return res.status(201).json(new ApiResponse(201, result, "Teachers uploaded successfully"));
});

export const getAllTeachers = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const teachers = await teacherService.getAllTeachers(school_id);
  return res.status(200).json(new ApiResponse(200, teachers, "Teachers fetched"));
});

export const getTeacherById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const teacher = await teacherService.getTeacherById(id);
  return res.status(200).json(new ApiResponse(200, teacher, "Teacher fetched"));
});

export const updateTeacher = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const teacher = await teacherService.updateTeacher(id, req.body);
  return res.status(200).json(new ApiResponse(200, teacher, "Teacher updated successfully"));
});

export const deleteTeacher = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await teacherService.deleteTeacher(id);
  return res.status(200).json(new ApiResponse(200, null, "Teacher deleted successfully"));
});
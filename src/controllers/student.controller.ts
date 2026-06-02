import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { studentService } from "../services/student.service.js";

export const createStudent = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const student = await studentService.createStudent({ ...req.body, school_id });
  return res.status(201).json(new ApiResponse(201, student, "Student created successfully"));
});

export const bulkStudentUpload = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const file = (req as any).file;

  if (!file) throw new ApiError(400, "Excel file required");

  const result = await studentService.bulkStudentUpload(file.path, school_id);
  return res.status(201).json(new ApiResponse(201, result, "Students uploaded successfully"));
});

export const getAllStudents = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const students = await studentService.getAllStudents(school_id);
  return res.status(200).json(new ApiResponse(200, students, "Students fetched"));
});

export const getStudentById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const student = await studentService.getStudentById(id);
  return res.status(200).json(new ApiResponse(200, student, "Student fetched"));
});

export const getStudentProfile = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const student = await studentService.getStudentProfile(id);
  return res.status(200).json(new ApiResponse(200, student, "Student profile fetched"));
});

export const getStudentAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const analytics = await studentService.getStudentAnalytics(id);
  return res.status(200).json(new ApiResponse(200, analytics || null, "Student analytics fetched"));
});

export const updateStudent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const student = await studentService.updateStudent(id, req.body);
  return res.status(200).json(new ApiResponse(200, student, "Student updated successfully"));
});

export const deleteStudent = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  await studentService.deleteStudent(id);
  return res.status(200).json(new ApiResponse(200, null, "Student deleted successfully"));
});
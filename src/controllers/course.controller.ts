import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

import { classService } from "../services/class.service.js";
import { sectionService } from "../services/section.service.js";
import { courseService } from "../services/course.service.js";

import StudentProfile from "../models/student_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";

/* =====================================================
   CLASS CONTROLLERS
   ===================================================== */

export const createClass = asyncHandler(async (req: Request, res: Response) => {
  const { class_name } = req.body;
  const newClass = await classService.createClass(class_name);
  return res.status(201).json(new ApiResponse(201, newClass, "Class created"));
});

export const bulkCreateClasses = asyncHandler(async (req: Request, res: Response) => {
  const { classes } = req.body;
  const createdClasses = await classService.bulkCreateClasses({ classes });
  return res.status(201).json(new ApiResponse(201, createdClasses, "Classes created successfully"));
});

export const getAllClasses = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = (req as any).user;
  const filteredClasses = await classService.getAllClasses(school_id);
  return res.status(200).json(new ApiResponse(200, filteredClasses, "Classes fetched"));
});

export const getStudentClass = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = (req as any).user;

  const studentProfile = await StudentProfile.findOne({ where: { user_id } });

  if (studentProfile) {
    const classSection = await StudentClassSection.findOne({
      where: { student_id: studentProfile.student_id },
    });
    if (!classSection) throw new ApiError(404, "Class not assigned to this student");

    const [classRow, sectionRow] = await Promise.all([
      AdminClass.findByPk((classSection as any).class_id),
      AdminSection.findByPk((classSection as any).section_id),
    ]);

    if (!classRow) throw new ApiError(404, "Class not found");

    return res.status(200).json(
      new ApiResponse(200, {
        student_id:   studentProfile.student_id,
        class_id:     (classRow as any).class_id,
        class_name:   (classRow as any).class_name,
        section_id:   (sectionRow as any)?.section_id   ?? null,
        section_name: (sectionRow as any)?.section_name ?? null,
      }, "Student class fetched")
    );
  }

  const teacherProfile = await TeacherProfile.findOne({ where: { user_id } });
  if (!teacherProfile) throw new ApiError(404, "User profile not found");

  const teacherAssignments = await TeacherClassSectionSubject.findAll({
    where: { teacher_id: teacherProfile.teacher_id },
  });

  const classIds = [...new Set(teacherAssignments.map((a) => (a as any).class_id))];
  const assignedClasses = await AdminClass.findAll({ where: { class_id: classIds } });

  return res.status(200).json(
    new ApiResponse(200, {
      teacher_id: teacherProfile.teacher_id,
      class_id:   (assignedClasses[0] as any)?.class_id   || null,
      class_name: (assignedClasses[0] as any)?.class_name || "",
      classes:    assignedClasses.map((c) => ({
        class_id:   (c as any).class_id,
        class_name: (c as any).class_name,
      })),
    }, "Teacher classes fetched")
  );
});

export const getClassById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const classData = await classService.getClassById(id);
  return res.status(200).json(new ApiResponse(200, classData, "Class fetched"));
});

export const updateClass = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const classData = await classService.updateClass(id, req.body);
  return res.status(200).json(new ApiResponse(200, classData, "Class updated"));
});

export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await classService.deleteClass(id);
  return res.status(200).json(new ApiResponse(200, {}, "Class and related data deleted"));
});

/* =====================================================
   SECTION CONTROLLERS
   ===================================================== */

export const createSection = asyncHandler(async (req: Request, res: Response) => {
  const { class_id, section_name } = req.body;
  const { school_id } = (req as any).user;

  const section = await sectionService.createSection({ class_id, section_name, school_id });
  return res.status(201).json(new ApiResponse(201, section, "Section created"));
});

export const bulkCreateSections = asyncHandler(async (req: Request, res: Response) => {
  const { classes } = req.body;
  const { school_id } = (req as any).user;

  const createdData = await sectionService.bulkCreateSections({ classes, school_id });
  return res.status(201).json(new ApiResponse(201, createdData, "Sections created successfully"));
});

export const getSectionsByClass = asyncHandler(async (req: Request, res: Response) => {
  const class_id = String(req.params.class_id);
  const { school_id } = (req as any).user;

  const sections = await sectionService.getSectionsByClass(class_id, school_id);
  return res.status(200).json(new ApiResponse(200, sections, "Sections fetched"));
});

export const updateSection = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { school_id } = (req as any).user;

  const section = await sectionService.updateSection(id, school_id, req.body);
  return res.status(200).json(new ApiResponse(200, section, "Section updated"));
});

export const deleteSection = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { school_id } = (req as any).user;

  await sectionService.deleteSection(id, school_id);
  return res.status(200).json(new ApiResponse(200, {}, "Section deleted"));
});

/* =====================================================
   COURSE CONTROLLERS
   ===================================================== */

export const createCourse = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = (req as any).user;
  const { course_name, course_type, language, ai_features } = req.body;

  const course = await courseService.createCourse({ school_id, course_name, course_type, language, ai_features });
  return res.status(201).json(new ApiResponse(201, course, "Course created"));
});

export const getAllCourses = asyncHandler(async (req: Request, res: Response) => {
  const { school_id } = (req as any).user;
  const courses = await courseService.getAllCourses(school_id);
  return res.status(200).json(new ApiResponse(200, courses, "Courses fetched"));
});

export const getCourseById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const course = await courseService.getCourseById(id);
  return res.status(200).json(new ApiResponse(200, course, "Course fetched"));
});

export const updateCourse = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const course = await courseService.updateCourse(id, req.body);
  return res.status(200).json(new ApiResponse(200, course, "Course updated"));
});

export const deleteCourse = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await courseService.deleteCourse(id);
  return res.status(200).json(new ApiResponse(200, {}, "Course deleted"));
});
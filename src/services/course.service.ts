import { ApiError } from "../utils/ApiError.js";
import { courseRepository } from "../repositories/course.repository.js";
import AdminCourse from "../models/admin_course.model.js";

interface CreateCourseInput {
  school_id: number | bigint;
  course_name: string;
  course_type?: string;
  language?: string;
  ai_features?: object;
}

export class CourseService {

  async createCourse({ school_id, course_name, course_type, language, ai_features }: CreateCourseInput): Promise<AdminCourse> {
    if (!course_name) throw new ApiError(400, "Course name required");

    return courseRepository.create({
      school_id,
      course_name,
      course_type,
      language,
      ai_features,
      status: "active",
    });
  }

  async getAllCourses(school_id: number | bigint): Promise<AdminCourse[]> {
    return courseRepository.findAllBySchool(school_id);
  }

  async getCourseById(id: number | string | bigint): Promise<AdminCourse> {
    const course = await courseRepository.findById(id);
    if (!course) throw new ApiError(404, "Course not found");
    return course;
  }

  async updateCourse(id: number | string | bigint, body: Partial<AdminCourse>): Promise<AdminCourse> {
    const course = await courseRepository.findById(id);
    if (!course) throw new ApiError(404, "Course not found");
    return courseRepository.update(course, body);
  }

  async deleteCourse(id: number | string | bigint): Promise<void> {
    const course = await courseRepository.findById(id);
    if (!course) throw new ApiError(404, "Course not found");
    await courseRepository.delete(course);
  }
}

export const courseService = new CourseService();
import AdminCourse from "../models/admin_course.model.js";

interface CreateCourseData {
  school_id: number | bigint;
  course_name: string;
  course_type?: string;
  language?: string;
  ai_features?: object;
  status: string;
}

export class CourseRepository {

  async create(data: CreateCourseData): Promise<AdminCourse> {
    return AdminCourse.create({
      // ...data,
      // school_id: BigInt(data.school_id),
      // status: data.status as "active" | "inactive",
    });
  }

  async findAllBySchool(school_id: number | bigint): Promise<AdminCourse[]> {
    return AdminCourse.findAll({ where: { school_id } });
  }

  async findById(id: number | string | bigint): Promise<AdminCourse | null> {
    return AdminCourse.findByPk(id);
  }

  async update(course: AdminCourse, body: Partial<AdminCourse>): Promise<AdminCourse> {
    return course.update(body);
  }

  async delete(course: AdminCourse): Promise<void> {
    await course.destroy();
  }
}

export const courseRepository = new CourseRepository();
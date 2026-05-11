import School from "../models/admin_school.model.js";

export class SchoolRepository {
  async findActiveCbseSchool() {
    return await School.findOne({
      where: { school_name : "CBSE", board: "CBSE", status: "Active" },
    });
  }

  async findById(school_id: number | string, attributes?: string[]) {
    return await School.findByPk(school_id, {
      attributes,
    });
  }

  async incrementCount(school_id: number | string, field: "student_count" | "teacher_count") {
    return await School.increment(field, {
      by: 1,
      where: { school_id },
    });
  }
}

export default new SchoolRepository();

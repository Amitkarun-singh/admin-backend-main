import sequelize from "../config/db.js";
import User from "../models/user.model.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminRole from "../models/admin_role.model.js";

export class StudentRepository {

  async findSchoolById(school_id: number | bigint): Promise<AdminSchool | null> {
    return AdminSchool.findByPk(school_id);
  }

  async findRoleByName(role_name: string, transaction?: any): Promise<AdminRole | null> {
    return AdminRole.findOne({ where: { role_name }, transaction });
  }

  // ─── User lookups ─────────────────────────────────────────────────────────

  /**
   * Primary deduplication lookup for both students and parents.
   * Unique key = full_name (title-cased) + phone_number.
   */
  async findUserByNameAndPhone(
    full_name: string,
    phone_number: string,
    transaction?: any,
  ): Promise<User | null> {
    return User.findOne({ where: { full_name, phone_number }, transaction });
  }

  // ─── Profile lookups ──────────────────────────────────────────────────────

  async findStudentProfileByUserId(user_id: number | bigint, transaction?: any): Promise<StudentProfile | null> {
    return StudentProfile.findOne({ where: { user_id }, transaction });
  }

  async findParentProfileByUserId(user_id: number | bigint, transaction?: any): Promise<ParentProfile | null> {
    return ParentProfile.findOne({ where: { user_id }, transaction });
  }

  async findParentStudentMapping(
    parent_id: bigint,
    student_id: bigint,
    transaction?: any,
  ): Promise<ParentStudentMap | null> {
    return ParentStudentMap.findOne({ where: { parent_id, student_id }, transaction });
  }

  // ─── Create helpers ───────────────────────────────────────────────────────

  async createUser(data: Record<string, any>, transaction?: any): Promise<User> {
    return User.create(data, { transaction });
  }

  async createStudentProfile(data: Record<string, any>, transaction?: any): Promise<StudentProfile> {
    return StudentProfile.create(data, { transaction });
  }

  async createParentProfile(data: Record<string, any>, transaction?: any): Promise<ParentProfile> {
    return ParentProfile.create(data, { transaction });
  }

  async createParentStudentMap(
    data: { parent_id: bigint; student_id: bigint },
    transaction?: any,
  ): Promise<ParentStudentMap> {
    return ParentStudentMap.create(data, { transaction });
  }

  async createClassSection(data: Record<string, any>, transaction?: any): Promise<StudentClassSection> {
    return StudentClassSection.create(data, { transaction });
  }

  /**
   * Find the enrolment row for a student by student_id alone.
   *
   * student_class_section has student_id as its sole PRIMARY KEY, so a student
   * can only have one row at a time. Looking up by class+section as well would
   * miss the row when a student is changing class — causing a duplicate PK insert.
   */
  async findClassSectionEnrolmentByStudent(
    student_id: bigint | number,
    transaction?: any,
  ): Promise<StudentClassSection | null> {
    return StudentClassSection.findOne({
      where: { student_id },
      transaction,
    });
  }

  /**
   * Patch any fields (class_id, section_id, roll_number, academic_year, status)
   * on the enrolment row identified by student_id.
   * Only called with a non-empty diff — never does a full replace.
   */
  async updateClassSectionEnrolmentByStudent(
    student_id: bigint | number,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await StudentClassSection.update(updates, {
      where: { student_id },
      transaction,
    });
  }

  async incrementSchoolStudentCount(school_id: number | bigint, by: number, transaction?: any): Promise<void> {
    await AdminSchool.increment("student_count", { by, where: { school_id }, transaction });
  }

  // ─── Update helpers (upsert path) ─────────────────────────────────────────

  /**
   * Patch specific fields on an existing User row.
   * Only called with a non-empty diff object — never does a full replace.
   */
  async updateUser(
    user_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await User.update(updates, { where: { user_id }, transaction });
  }

  /**
   * Patch specific fields on an existing StudentProfile row.
   */
  async updateStudentProfile(
    student_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await StudentProfile.update(updates, { where: { student_id }, transaction });
  }

  /**
   * Patch specific fields on an existing ParentProfile row.
   */
  async updateParentProfile(
    parent_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await ParentProfile.update(updates, { where: { parent_id }, transaction });
  }

  // ─── Standard queries ─────────────────────────────────────────────────────

  async findAllStudents(school_id: number | bigint): Promise<StudentProfile[]> {
    return StudentProfile.findAll({
      where: { school_id },
      include: [
        {
          model: User, as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection, as: "classSection",
          attributes: ["class_id", "section_id", "academic_year", "roll_number", "status"],
          include: [
            { model: AdminClass,   as: "class",   attributes: ["class_id",   "class_name"]   },
            { model: AdminSection, as: "section", attributes: ["section_id", "section_name"] },
          ],
        },
      ],
    });
  }

  async findStudentById(id: number | string | bigint): Promise<StudentProfile | null> {
    return StudentProfile.findByPk(id, {
      include: [
        {
          model: User, as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection, as: "classSection",
          attributes: ["class_id", "section_id", "academic_year", "roll_number", "status"],
          include: [
            { model: AdminClass,   as: "class",   attributes: ["class_id",   "class_name"]   },
            { model: AdminSection, as: "section", attributes: ["section_id", "section_name"] },
          ],
        },
      ],
    });
  }

  async findStudentProfile(id: number | string | bigint): Promise<StudentProfile | null> {
    return StudentProfile.findByPk(id, {
      include: [
        {
          model: User, as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection, as: "classSection",
          attributes: ["class_id", "section_id", "academic_year", "roll_number", "status"],
          include: [
            { model: AdminClass,   as: "class",   attributes: ["class_id",   "class_name"]   },
            { model: AdminSection, as: "section", attributes: ["section_id", "section_name"] },
          ],
        },
        {
          model: ParentProfile, as: "parents",
          through: { attributes: [] } as any,
          include: [
            {
              model: User, as: "user",
              attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "avatar"],
            },
          ],
        },
      ],
    });
  }

  async findStudentAnalytics(student_id: number | string | bigint): Promise<StudentAnalytics | null> {
    return StudentAnalytics.findOne({ where: { student_id } });
  }

  async findClassByName(class_name: string, transaction?: any): Promise<AdminClass | null> {
    return AdminClass.findOne({ where: { class_name }, transaction });
  }

  async findSectionByName(class_id: number, section_name: string, transaction?: any): Promise<AdminSection | null> {
    return AdminSection.findOne({ where: { class_id, section_name }, transaction });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteStudentWithRelated(
    id: number | string | bigint,
    user_id: number | bigint,
    school_id: number | bigint,
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      await StudentClassSection.destroy({ where: { student_id: id },  transaction });
      await ParentStudentMap.destroy({ where: { student_id: id },      transaction });
      await StudentAnalytics.destroy({ where: { student_id: id },      transaction });
      const student = await StudentProfile.findByPk(id, { transaction });
      await student?.destroy({ transaction });
      await User.destroy({ where: { user_id },                          transaction });
      await AdminSchool.increment("student_count", { by: -1, where: { school_id }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const studentRepository = new StudentRepository();
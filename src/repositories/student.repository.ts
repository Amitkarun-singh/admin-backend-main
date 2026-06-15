import sequelize from "../config/db.js";
import User from "../models/user.model.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminRole from "../models/admin_role.model.js";

// ─── NOTE ──────────────────────────────────────────────────────────────────────
// AdminClass and AdminSection are intentionally NOT imported.
// Class / section / stream data is owned by the curriculum microservice.
// class_id, section_id, stream_id are stored as plain integers in
// student_class_section. The frontend resolves names via the
// /api/v1/curriculum/proxy/* routes.
// ──────────────────────────────────────────────────────────────────────────────

export class StudentRepository {

  async findSchoolById(school_id: number | bigint): Promise<AdminSchool | null> {
    return AdminSchool.findByPk(school_id);
  }

  async findRoleByName(role_name: string, transaction?: any): Promise<AdminRole | null> {
    return AdminRole.findOne({ where: { role_name }, transaction });
  }

  // ─── User lookups ─────────────────────────────────────────────────────────

  /**
   * Deduplication lookup for students and parents in bulk upload.
   *
   * Unique key = full_name + phone_number + role_id
   *
   * Why all three:
   *   phone alone          → siblings sharing a family phone would false-match
   *   name + phone         → correctly identifies a parent across two sibling rows
   *   + role_id            → a person who is both parent & student (adult ed)
   *                          has two separate accounts; role_id keeps them apart
   */
  async findUserByNamePhoneAndRole(
    full_name: string,
    phone_number: string,
    role_id: number,
    transaction?: any,
  ): Promise<User | null> {
    return User.findOne({ where: { full_name, phone_number, role_id }, transaction });
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
    return StudentClassSection.create(data as any, { transaction });
  }

  /**
   * Find the enrolment row for a student by student_id alone.
   * student_class_section has student_id as its sole PRIMARY KEY so a student
   * can only have one row at a time.
   */
  async findClassSectionEnrolmentByStudent(
    student_id: bigint | number,
    transaction?: any,
  ): Promise<StudentClassSection | null> {
    return StudentClassSection.findOne({ where: { student_id }, transaction });
  }

  /**
   * Patch fields on the enrolment row identified by student_id.
   * Only called with a non-empty diff — never does a full replace.
   */
  async updateClassSectionEnrolmentByStudent(
    student_id: bigint | number,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await StudentClassSection.update(updates, { where: { student_id }, transaction });
  }

  async incrementSchoolStudentCount(school_id: number | bigint, by: number, transaction?: any): Promise<void> {
    await AdminSchool.increment("student_count", { by, where: { school_id }, transaction });
  }

  // ─── Update helpers ────────────────────────────────────────────────────────

  async updateUser(
    user_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await User.update(updates, { where: { user_id }, transaction });
  }

  async updateStudentProfile(
    student_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await StudentProfile.update(updates, { where: { student_id }, transaction });
  }

  async updateParentProfile(
    parent_id: number | bigint,
    updates: Record<string, any>,
    transaction?: any,
  ): Promise<void> {
    await ParentProfile.update(updates, { where: { parent_id }, transaction });
  }

  // ─── Standard queries ─────────────────────────────────────────────────────
  //
  // All three queries include the parents association so the UI receives
  // parent_id (and basic parent info) alongside every student record.
  // The frontend uses parent_id to build the "linked parent" section.
  //
  // AdminClass / AdminSection joins removed — IDs are returned as plain
  // integers and resolved to names by the frontend via the proxy routes.

  async findAllStudents(school_id: number | bigint): Promise<StudentProfile[]> {
    return StudentProfile.findAll({
      where: { school_id },
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection,
          as: "classSection",
          attributes: ["class_id", "section_id", "stream_id", "academic_year", "roll_number", "status"],
        },
        {
          // parent_id + basic info so the list view can show "has linked parent"
          // and the UI can navigate to the parent detail page
          model: ParentProfile,
          as: "parents",
          attributes: ["parent_id", "relation"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "full_name", "phone_number", "avatar"],
            },
          ],
        },
      ],
    });
  }

  async findStudentById(id: number | string | bigint): Promise<StudentProfile | null> {
    return StudentProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection,
          as: "classSection",
          attributes: ["class_id", "section_id", "stream_id", "academic_year", "roll_number", "status"],
        },
        {
          model: ParentProfile,
          as: "parents",
          attributes: ["parent_id", "relation"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
              attributes: ["user_id", "full_name", "phone_number", "avatar"],
            },
          ],
        },
      ],
    });
  }

  async findStudentProfile(id: number | string | bigint): Promise<StudentProfile | null> {
    return StudentProfile.findByPk(id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "username", "full_name", "email", "phone_number", "address", "status", "avatar"],
        },
        {
          model: StudentClassSection,
          as: "classSection",
          attributes: ["class_id", "section_id", "stream_id", "academic_year", "roll_number", "status"],
        },
        {
          // Full parent detail for the student profile / linked-parent section
          model: ParentProfile,
          as: "parents",
          attributes: ["parent_id", "relation"],
          through: { attributes: [] } as any,
          include: [
            {
              model: User,
              as: "user",
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

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteStudentWithRelated(
    id: number | string | bigint,
    user_id: number | bigint,
    school_id: number | bigint,
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      await StudentClassSection.destroy({ where: { student_id: id }, transaction });
      await ParentStudentMap.destroy({ where: { student_id: id },    transaction });
      await StudentAnalytics.destroy({ where: { student_id: id },    transaction });
      const student = await StudentProfile.findByPk(id, { transaction });
      await student?.destroy({ transaction });
      await User.destroy({ where: { user_id },                        transaction });
      await AdminSchool.increment("student_count", { by: -1, where: { school_id }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const studentRepository = new StudentRepository();
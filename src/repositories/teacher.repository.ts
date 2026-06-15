import sequelize from "../config/db.js";
import User from "../models/user.model.js";
import AdminRole from "../models/admin_role.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";
import TeacherAnalytics from "../models/teacher_analytics.model.js";
import AdminSchool from "../models/admin_school.model.js";
import curriculumService from "../services/curriculum.service.js";

// ─── NOTE ──────────────────────────────────────────────────────────────────────
// AdminClass, AdminSection, AdminSubject are intentionally NOT imported.
// Class / section / stream / subject data is owned by the curriculum
// microservice. All Sequelize includes that previously joined those models
// have been removed. IDs are stored as plain integers and resolved to names
// by the service layer (enrichTeacher) or the frontend proxy routes.
// ──────────────────────────────────────────────────────────────────────────────

// Teacher includes — only local DB models (User + assignments with stream_id)
const teacherIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["user_id", "username", "full_name", "phone_number", "email", "status", "avatar"],
  },
  {
    model: TeacherClassSectionSubject,
    as: "assignments",
    // stream_id is now stored on every assignment row
    attributes: ["id", "class_id", "section_id", "stream_id", "class_subject_id", "academic_year"],
  },
];

// ─── Curriculum helpers (used by findSubjectById / findSubjectsByIds) ──────────

async function curriculumAllClasses(): Promise<any[]> {
  const raw = await curriculumService.allClass();
  return Array.isArray(raw) ? raw : (raw?.data ?? []);
}

// ─── Repository ────────────────────────────────────────────────────────────────

export class TeacherRepository {

  async findSchoolById(school_id: number | bigint): Promise<AdminSchool | null> {
    return AdminSchool.findOne({ where: { school_id } });
  }

  async findRoleByName(role_name: string, transaction?: any): Promise<AdminRole | null> {
    return AdminRole.findOne({ where: { role_name }, transaction });
  }

  // ─── User lookups ─────────────────────────────────────────────────────────

  /**
   * Deduplication lookup for teachers in bulk upload.
   *
   * Unique key = full_name (Name Surname) + phone_number + role_id
   *
   * Why all three:
   *   phone alone      → two different teachers could share an office phone
   *   name + phone     → correctly identifies the same teacher across re-uploads
   *   + role_id        → a teacher who also has a parent account is kept separate
   */
  async findUserByNamePhoneAndRole(
    full_name: string,
    phone_number: string,
    role_id: number,
    transaction?: any,
  ): Promise<User | null> {
    return User.findOne({ where: { full_name, phone_number, role_id }, transaction });
  }

  async findTeacherProfileByUserId(user_id: number | bigint, transaction?: any): Promise<TeacherProfile | null> {
    return TeacherProfile.findOne({ where: { user_id }, transaction });
  }

  // ─── Create helpers ───────────────────────────────────────────────────────

  async createUser(data: Record<string, any>, transaction?: any): Promise<User> {
    return User.create(data, { transaction });
  }

  async createTeacherProfile(data: Record<string, any>, transaction?: any): Promise<TeacherProfile> {
    return TeacherProfile.create(data, { transaction });
  }

  async bulkCreateAssignments(rows: Record<string, any>[], transaction?: any): Promise<void> {
    if (rows.length) await TeacherClassSectionSubject.bulkCreate(rows, { transaction });
  }

  async incrementSchoolTeacherCount(school_id: number | bigint, by: number, transaction?: any): Promise<void> {
    await AdminSchool.increment("teacher_count", { by, where: { school_id }, transaction });
  }

  // ─── Standard queries ─────────────────────────────────────────────────────

  async findAllTeachers(school_id: number | bigint): Promise<TeacherProfile[]> {
    return TeacherProfile.findAll({ where: { school_id }, include: teacherIncludes });
  }

  async findTeacherById(id: number | string | bigint): Promise<TeacherProfile | null> {
    return TeacherProfile.findByPk(id, { include: teacherIncludes });
  }

  async findTeacherRaw(id: number | string | bigint): Promise<TeacherProfile | null> {
    return TeacherProfile.findByPk(id);
  }

  // ─── Update helpers ────────────────────────────────────────────────────────

  async updateTeacher(teacher: TeacherProfile, data: Record<string, any>, transaction?: any): Promise<TeacherProfile> {
    return teacher.update(data, { transaction });
  }

  async updateUser(user_id: number | bigint, data: Record<string, any>, transaction?: any): Promise<void> {
    await User.update(data, { where: { user_id }, transaction });
  }

  async updateTeacherProfile(teacher_id: number | bigint, data: Record<string, any>, transaction?: any): Promise<void> {
    await TeacherProfile.update(data, { where: { teacher_id }, transaction });
  }

  // ─── Assignment helpers ────────────────────────────────────────────────────

  async findAssignmentByTeacher(teacher_id: number | bigint, transaction?: any): Promise<TeacherClassSectionSubject | null> {
    return TeacherClassSectionSubject.findOne({ where: { teacher_id }, transaction });
  }

  async deleteAssignmentsByTeacher(teacher_id: number | string | bigint, transaction?: any): Promise<void> {
    await TeacherClassSectionSubject.destroy({ where: { teacher_id }, transaction });
  }

  // ─── Subject lookups (via curriculum microservice) ─────────────────────────

  /**
   * Find a single subject by its curriculum-service ID.
   * Scans all classes until found. Returns { id, subject_id, subject_name, class_id }.
   */
  async findSubjectById(
    subject_id: number | string,
    _transaction?: any,
  ): Promise<{ id: number; subject_id: number; subject_name: string; class_id: number | null } | null> {
    const sid = Number(subject_id);
    try {
      const classes = await curriculumAllClasses();
      for (const cls of classes) {
        const classId = cls.id;
        const raw     = await curriculumService.allSubject(classId, "", 4);
        const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        const found = list.find((s: any) => Number(s.id) === sid);
        if (found) return { id: sid, subject_id: sid, subject_name: found.subject_name ?? found.name, class_id: classId };
      }
      return null;
    } catch { return null; }
  }

  /**
   * Find multiple subjects by their curriculum-service IDs.
   */
  async findSubjectsByIds(
    ids: number[],
    _transaction?: any,
  ): Promise<Array<{ id: number; subject_id: number; subject_name: string; class_id: number | null }>> {
    if (!ids.length) return [];
    const idSet   = new Set(ids.map(Number));
    const results: Array<{ id: number; subject_id: number; subject_name: string; class_id: number | null }> = [];
    try {
      const classes = await curriculumAllClasses();
      for (const cls of classes) {
        if (results.length >= ids.length) break;
        const classId = cls.id;
        const raw     = await curriculumService.allSubject(classId, "", 4);
        const list: any[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
        for (const s of list) {
          const sid = Number(s.id);
          if (idSet.has(sid)) {
            results.push({ id: sid, subject_id: sid, subject_name: s.subject_name ?? s.name, class_id: classId });
            idSet.delete(sid);
          }
        }
      }
    } catch { /* return what we have */ }
    return results;
  }

  /**
   * Find secondary subjects from a raw JSON array of IDs.
   * Returns enriched objects with class_name from curriculum.
   */
  async findSecondarySubjects(
    rawIds: any,
  ): Promise<Array<{ id: number; subject_id: number; subject_name: string; class_id: number | null; class?: { class_name: string } }>> {
    let ids: any[] = rawIds;
    if (typeof rawIds === "string") {
      try { ids = JSON.parse(rawIds); } catch { return []; }
    }
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const cleanIds = ids.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (!cleanIds.length) return [];

    const found = await this.findSubjectsByIds(cleanIds);
    try {
      const classes  = await curriculumAllClasses();
      const classMap = Object.fromEntries(classes.map((c: any) => [Number(c.id), c.class_name]));
      return found.map((s) => ({
        ...s,
        class: s.class_id != null ? { class_name: classMap[s.class_id] ?? null } : undefined,
      }));
    } catch {
      return found;
    }
  }

  getTeacherIncludes() { return teacherIncludes; }

  // ─── Delete ───────────────────────────────────────────────────────────────

  async deleteTeacherWithRelated(
    id: number | string | bigint,
    user_id: number | bigint,
    school_id: number | bigint,
  ): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      await TeacherClassSectionSubject.destroy({ where: { teacher_id: id }, transaction });
      await TeacherAnalytics.destroy(          { where: { teacher_id: id }, transaction });
      const teacher = await TeacherProfile.findByPk(id, { transaction });
      await teacher?.destroy({ transaction });
      await User.destroy({ where: { user_id },  transaction });
      await AdminSchool.increment("teacher_count", { by: -1, where: { school_id }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export const teacherRepository = new TeacherRepository();
import sequelize from "../config/db.js";
import User from "../models/user.model.js";
import AdminRole from "../models/admin_role.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";
import TeacherAnalytics from "../models/teacher_analytics.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSubject from "../models/admin_subject_master.model.js";
import AdminSection from "../models/admin_section.model.js";
import { Op } from "sequelize";

const teacherIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["username", "full_name", "phone_number", "email", "status"],
  },
  {
    model: AdminSubject,
    as: "primarySubject",
    required: false,
    attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
    include: [
      { model: AdminClass, as: "class", attributes: ["class_id", "class_name"] },
    ],
  },
  {
    model: TeacherClassSectionSubject,
    as: "assignments",
    attributes: ["id", "class_id", "section_id", "class_subject_id", "academic_year"],
    include: [
      { model: AdminClass,   as: "class",   attributes: ["class_id", "class_name"]                          },
      { model: AdminSection, as: "section", attributes: ["section_id", "section_name"]                      },
      { model: AdminSubject, as: "subject", attributes: ["subject_id", "subject_name", "board", "language"] },
    ],
  },
];

export class TeacherRepository {

  async findSchoolById(school_id: number | bigint): Promise<AdminSchool | null> {
    return AdminSchool.findOne({ where: { school_id } });
  }

  async findRoleByName(role_name: string, transaction?: any): Promise<AdminRole | null> {
    return AdminRole.findOne({ where: { role_name }, transaction });
  }

  async createUser(data: Record<string, any>, transaction?: any): Promise<User> {
    return User.create(data, { transaction });
  }

  async createTeacherProfile(data: Record<string, any>, transaction?: any): Promise<TeacherProfile> {
    return TeacherProfile.create(data, { transaction });
  }

  async bulkCreateAssignments(rows: Record<string, any>[], transaction?: any): Promise<void> {
    if (rows.length) {
      await TeacherClassSectionSubject.bulkCreate(rows, { transaction });
    }
  }

  async incrementSchoolTeacherCount(school_id: number | bigint, by: number, transaction?: any): Promise<void> {
    await AdminSchool.increment("teacher_count", { by, where: { school_id }, transaction });
  }

  async findAllTeachers(school_id: number | bigint): Promise<TeacherProfile[]> {
    return TeacherProfile.findAll({ where: { school_id }, include: teacherIncludes });
  }

  async findTeacherById(id: number | string | bigint): Promise<TeacherProfile | null> {
    return TeacherProfile.findByPk(id, { include: teacherIncludes });
  }

  async findTeacherRaw(id: number | string | bigint): Promise<TeacherProfile | null> {
    return TeacherProfile.findByPk(id);
  }

  async updateTeacher(teacher: TeacherProfile, data: Record<string, any>, transaction?: any): Promise<TeacherProfile> {
    return teacher.update(data, { transaction });
  }

  async deleteAssignmentsByTeacher(teacher_id: number | string | bigint, transaction?: any): Promise<void> {
    await TeacherClassSectionSubject.destroy({ where: { teacher_id }, transaction });
  }

  async deleteTeacherWithRelated(id: number | string | bigint, user_id: number | bigint, school_id: number | bigint): Promise<void> {
    const transaction = await sequelize.transaction();
    try {
      await TeacherClassSectionSubject.destroy({ where: { teacher_id: id }, transaction });
      await TeacherAnalytics.destroy(          { where: { teacher_id: id }, transaction });
      const teacher = await TeacherProfile.findByPk(id, { transaction });
      await teacher?.destroy({ transaction });
      await User.destroy({ where: { user_id }, transaction });
      await AdminSchool.increment("teacher_count", { by: -1, where: { school_id }, transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findClassByName(class_name: string, transaction?: any): Promise<AdminClass | null> {
    return AdminClass.findOne({ where: { class_name }, transaction });
  }

  async findSubjectByParams(params: {
    class_id: number;
    subject_name: string;
    board: string;
    language: string;
  }, transaction?: any): Promise<AdminSubject | null> {
    return AdminSubject.findOne({ where: params, transaction });
  }

  async findSubjectById(subject_id: number | string, transaction?: any): Promise<AdminSubject | null> {
    return AdminSubject.findByPk(subject_id, { transaction });
  }

  async findSubjectsByIds(ids: number[], transaction?: any): Promise<AdminSubject[]> {
    return AdminSubject.findAll({ where: { subject_id: ids }, transaction });
  }

  async findSectionByName(class_id: number, section_name: string, transaction?: any): Promise<AdminSection | null> {
    return AdminSection.findOne({ where: { class_id, section_name }, transaction });
  }

  async findSecondarySubjects(rawIds: any): Promise<AdminSubject[]> {
    let ids = rawIds;
    if (typeof rawIds === "string") {
      try { ids = JSON.parse(rawIds); } catch { return []; }
    }
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const cleanIds = ids.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (!cleanIds.length) return [];
    return AdminSubject.findAll({
      where: { subject_id: cleanIds },
      attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
      include: [{ model: AdminClass, as: "class", attributes: ["class_id", "class_name"] }],
    });
  }

  getTeacherIncludes() {
    return teacherIncludes;
  }
}

export const teacherRepository = new TeacherRepository();
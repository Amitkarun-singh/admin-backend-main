import AdminSubject from "../models/admin_subject_master.model.js";
import AdminChapterMaster from "../models/admin_chapter_master.model.js";
import AdminClass from "../models/admin_class.model.js";
import User from "../models/user.model.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import AdminSchool from "../models/admin_school.model.js";

interface SubjectWhereClause {
  class_id?: number | string;
  board?: string;
  language?: string;
  [key: string]: any;
}

export class SubjectRepository {

  async findSubjectByUnique(params: {
    class_id: number;
    board: string;
    language: string;
    subject_name: string;
  }): Promise<AdminSubject | null> {
    return AdminSubject.findOne({ where: params });
  }

  async createSubject(data: {
    class_id: number;
    board: string;
    language: string;
    subject_name: string;
  }, transaction?: any): Promise<AdminSubject> {
    return AdminSubject.create(data, { transaction });
  }

  async bulkCreateChapters(payload: Record<string, any>[], transaction?: any): Promise<void> {
    await AdminChapterMaster.bulkCreate(payload as any, { transaction });
  }

  async findAllSubjects(where: SubjectWhereClause): Promise<AdminSubject[]> {
    return AdminSubject.findAll({ where });
  }

  async findSubjectById(subject_id: number | string): Promise<AdminSubject | null> {
    return AdminSubject.findByPk(subject_id);
  }

  async findChaptersByClassAndSubject(class_id: number | string, subject_id: number | string): Promise<AdminChapterMaster[]> {
    return AdminChapterMaster.findAll({
      where: { class_id, subject_id, status: "active" },
      order: [["chapter_order", "ASC"]],
      raw: true,
    });
  }

  async findChapterById(chapter_id: number | string): Promise<AdminChapterMaster | null> {
    return AdminChapterMaster.findByPk(chapter_id);
  }

  async findExistingChapters(subject_id: number | string): Promise<AdminChapterMaster[]> {
    return AdminChapterMaster.findAll({ where: { subject_id } });
  }

  async deleteChaptersBySubject(subject_id: number | string, transaction?: any): Promise<void> {
    await AdminChapterMaster.destroy({ where: { subject_id }, transaction });
  }

  async deleteSubjectById(subject_id: number | string, transaction?: any): Promise<void> {
    await AdminSubject.destroy({ where: { subject_id }, transaction });
  }

  async deleteChapterById(chapter_id: number | string): Promise<number> {
    return AdminChapterMaster.destroy({ where: { chapter_id } });
  }

  async findClassById(class_id: number | string): Promise<AdminClass | null> {
    return AdminClass.findByPk(class_id);
  }

  async findUserById(user_id: number | string): Promise<User | null> {
    return User.findOne({ where: { user_id }, attributes: ["user_id", "school_id"] });
  }

  async findSchoolById(school_id: number | string): Promise<AdminSchool | null> {
    return AdminSchool.findOne({ where: { school_id }, attributes: ["board"] });
  }

  async findStudentProfile(user_id: number | string): Promise<StudentProfile | null> {
    return StudentProfile.findOne({ where: { user_id }, attributes: ["student_id", "preferred_language"] });
  }

  async findStudentClassSection(student_id: number | string): Promise<StudentClassSection | null> {
    return StudentClassSection.findOne({
      where: { student_id, status: "active" },
      attributes: ["class_id"],
    });
  }
}

export const subjectRepository = new SubjectRepository();
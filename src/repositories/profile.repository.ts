import StudentProfile from "../models/student_profile.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";

export class ProfileRepository {
  async findStudentByUserId(user_id: number | string) {
    return await StudentProfile.findOne({ where: { user_id } });
  }

  async findTeacherByUserId(user_id: number | string) {
    return await TeacherProfile.findOne({ where: { user_id } });
  }

  async findParentByUserId(user_id: number | string) {
    return await ParentProfile.findOne({ where: { user_id } });
  }

  async createStudentProfile(data: any) {
    return await StudentProfile.create(data);
  }

  async createTeacherProfile(data: any) {
    return await TeacherProfile.create(data);
  }

  async findStudentClassSection(student_id: number | string) {
    return await StudentClassSection.findOne({ where: { student_id } });
  }

  async createStudentClassSection(data: any) {
    return await StudentClassSection.create(data);
  }

  async findParentStudentMappings(parent_id: number | string) {
    return await ParentStudentMap.findAll({ where: { parent_id } });
  }

  async findStudentsByIds(studentIds: (number | string)[]) {
    return await StudentProfile.findAll({ where: { student_id: studentIds } });
  }

  async createTeacherClassSectionSubject(data: any) {
    return await TeacherClassSectionSubject.create(data);
  }

  async updateStudentClassSection(student_id: number | string, data: any) {
    return await StudentClassSection.update(data, { where: { student_id } });
  }
}

export default new ProfileRepository();

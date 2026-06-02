import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";
import { ApiError } from "../utils/ApiError.js";
import { parseExcel } from "../utils/excel.util.js";
import { studentRepository } from "../repositories/student.repository.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";

const VALID_RELATIONS = ["father", "mother", "guardian"];
const VALID_GENDERS   = ["male", "female", "other"];

interface CreateStudentInput {
  student_username: string;
  student_password: string;
  student_phone?: string;
  student_email?: string;
  student_full_name?: string;
  parent_username: string;
  parent_password: string;
  parent_phone?: string;
  parent_email?: string;
  parent_full_name?: string;
  parent_name?: string;
  relation?: string;
  class_id?: number;
  section_id?: number;
  roll_number?: string;
  academic_year?: string;
  preferred_language?: string;
  onboarding_date?: string;
  cost_limit?: number;
  dob?: string;
  gender?: string;
  analytics_enabled?: boolean;
  school_id: number | bigint;
}

interface UpdateStudentInput {
  gender?: string;
  status?: string;
  [key: string]: any;
}

export class StudentService {

  async createStudent(input: CreateStudentInput): Promise<StudentProfile> {
    const {
      student_username, student_password, student_phone, student_email, student_full_name,
      parent_username,  parent_password,  parent_phone,  parent_email,  parent_full_name,
      parent_name, relation,
      class_id, section_id, roll_number, academic_year,
      preferred_language, onboarding_date, cost_limit, dob, gender, analytics_enabled,
      school_id,
    } = input;

    if (!student_username || !student_password || !parent_username || !parent_password) {
      throw new ApiError(400, "Required fields missing: student_username, student_password, parent_username, parent_password");
    }

    const school = await studentRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    const normalizedRelation = relation?.toLowerCase() || null;
    const normalizedGender   = gender?.toLowerCase()   || null;

    if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);

    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    const transaction = await sequelize.transaction();

    try {
      const [studentRole, parentRole] = await Promise.all([
        studentRepository.findRoleByName("STUDENT", transaction),
        studentRepository.findRoleByName("PARENT",  transaction),
      ]);
      if (!studentRole || !parentRole) throw new ApiError(400, "Student or Parent role missing");

      const parentHashed = await bcrypt.hash(parent_password, 10);
      const parentUser = await studentRepository.createUser({
        username: parent_username, full_name: parent_full_name || null,
        password: parentHashed, phone_number: parent_phone || null,
        email: parent_email || null, role_id: parentRole.role_id,
        school_id, status: "Active", is_password_reset_required: true,
      }, transaction);

      const parent = await studentRepository.createParentProfile({
        user_id: parentUser.user_id, school_id,
        parent_name: parent_name || null,
        relation: normalizedRelation,
      }, transaction);

      const studentHashed = await bcrypt.hash(student_password, 10);
      const studentUser = await studentRepository.createUser({
        username: student_username, full_name: student_full_name || null,
        password: studentHashed, phone_number: student_phone || null,
        email: student_email || null, role_id: studentRole.role_id,
        school_id, status: "Active", is_password_reset_required: true,
      }, transaction);

      const student = await studentRepository.createStudentProfile({
        user_id: studentUser.user_id, school_id,
        preferred_language: preferred_language || null,
        onboarding_date: onboarding_date || null,
        cost_limit: cost_limit || null,
        dob: dob || null,
        gender: normalizedGender,
        analytics_enabled: analytics_enabled ?? false,
      }, transaction);

      await studentRepository.createParentStudentMap(
        { parent_id: (parent as any).parent_id, student_id: student.student_id },
        transaction
      );

      await studentRepository.createClassSection({
        student_id: student.student_id,
        class_id: class_id || null, section_id: section_id || null,
        roll_number: roll_number || null, academic_year: academic_year || null,
        status: "active",
      }, transaction);

      await studentRepository.incrementSchoolStudentCount(school_id, 1, transaction);
      await transaction.commit();

      return student;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async bulkStudentUpload(filePath: string, school_id: number | bigint): Promise<{ created: number }> {
    const records = parseExcel(filePath);
    if (!records.length) throw new ApiError(400, "Excel file is empty");

    const transaction = await sequelize.transaction();

    try {
      const [studentRole, parentRole] = await Promise.all([
        studentRepository.findRoleByName("STUDENT", transaction),
        studentRepository.findRoleByName("PARENT",  transaction),
      ]);
      if (!studentRole || !parentRole) throw new ApiError(400, "Student or Parent role missing");

      let createdCount = 0;

      for (const [index, row] of (records as any[]).entries()) {
        const rowLabel = `Row ${index + 2}`;

        if (!row.student_username || !row.student_password || !row.parent_username || !row.parent_password)
          throw new ApiError(400, `${rowLabel}: Missing required fields`);

        const normalizedRelation = row.relation?.toLowerCase() || null;
        const normalizedGender   = row.gender?.toLowerCase()   || null;

        if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
          throw new ApiError(400, `${rowLabel}: Invalid relation "${row.relation}"`);

        if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
          throw new ApiError(400, `${rowLabel}: Invalid gender "${row.gender}"`);

        let resolvedClassId:   number | null = null;
        let resolvedSectionId: number | null = null;

        if (row.class_name) {
          const classRecord = await studentRepository.findClassByName(row.class_name, transaction);
          if (classRecord) {
            resolvedClassId = (classRecord as any).class_id;
            if (row.section_name) {
              const sectionRecord = await studentRepository.findSectionByName(resolvedClassId!, row.section_name, transaction);
              resolvedSectionId = (sectionRecord as any)?.section_id ?? null;
            }
          }
        }

        const parentHashed = await bcrypt.hash(String(row.parent_password), 10);
        const parentUser = await studentRepository.createUser({
          username: row.parent_username, full_name: row.parent_full_name || null,
          password: parentHashed, phone_number: row.parent_phone || null,
          email: row.parent_email || null, role_id: parentRole.role_id,
          school_id, status: "Active", is_password_reset_required: true,
        }, transaction);

        const parent = await studentRepository.createParentProfile({
          user_id: parentUser.user_id, school_id,
          parent_name: row.parent_name || null,
          relation: normalizedRelation,
        }, transaction);

        const studentHashed = await bcrypt.hash(String(row.student_password), 10);
        const studentUser = await studentRepository.createUser({
          username: row.student_username, full_name: row.student_full_name || null,
          password: studentHashed, phone_number: row.student_phone || null,
          email: row.student_email || null, role_id: studentRole.role_id,
          school_id, status: "Active", is_password_reset_required: true,
        }, transaction);

        const student = await studentRepository.createStudentProfile({
          user_id: studentUser.user_id, school_id,
          preferred_language: row.preferred_language || null,
          onboarding_date: row.onboarding_date || null,
          cost_limit: row.cost_limit || null,
          dob: row.dob || null,
          gender: normalizedGender,
          analytics_enabled: row.analytics_enabled ?? false,
        }, transaction);

        await studentRepository.createParentStudentMap(
          { parent_id: (parent as any).parent_id, student_id: student.student_id },
          transaction
        );

        await studentRepository.createClassSection({
          student_id: student.student_id,
          class_id: resolvedClassId, section_id: resolvedSectionId,
          roll_number: row.roll_number || null, academic_year: row.academic_year || null,
          status: "active",
        }, transaction);

        createdCount++;
      }

      await studentRepository.incrementSchoolStudentCount(school_id, createdCount, transaction);
      await transaction.commit();
      fs.unlinkSync(filePath);

      return { created: createdCount };
    } catch (error) {
      await transaction.rollback();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw error;
    }
  }

  async getAllStudents(school_id: number | bigint): Promise<StudentProfile[]> {
    return studentRepository.findAllStudents(school_id);
  }

  async getStudentById(id: number | string | bigint): Promise<StudentProfile> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");
    return student;
  }

  async getStudentProfile(id: number | string | bigint): Promise<StudentProfile> {
    const student = await studentRepository.findStudentProfile(id);
    if (!student) throw new ApiError(404, "Student not found");
    return student;
  }

  async getStudentAnalytics(id: number | string | bigint): Promise<StudentAnalytics | null> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");
    return studentRepository.findStudentAnalytics(id);
  }

  async updateStudent(id: number | string | bigint, body: UpdateStudentInput): Promise<StudentProfile> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");

    const { status, gender, ...rest } = body;
    const normalizedGender = gender?.toLowerCase() || null;

    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    await (student as any).update({ ...rest, ...(normalizedGender && { gender: normalizedGender }) });
    return student;
  }

  async deleteStudent(id: number | string | bigint): Promise<void> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");

    const { school_id, user_id } = student as any;
    await studentRepository.deleteStudentWithRelated(id, user_id, school_id);
  }
}

export const studentService = new StudentService();
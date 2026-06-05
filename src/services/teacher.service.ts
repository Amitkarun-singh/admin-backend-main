import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";
import { ApiError } from "../utils/ApiError.js";
import { parseExcel } from "../utils/excel.util.js";
import { teacherRepository } from "../repositories/teacher.repository.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import AdminSubject from "../models/admin_subject_master.model.js";

interface CreateTeacherInput {
  school_id: number | bigint;
  username: string;
  password: string;
  phone_number?: string;
  email?: string;
  full_name?: string;
  gender?: string;
  preferred_language?: string;
  class_name?: string;
  subject_name?: string;
  section_name?: string;
  primary_subject_id?: number;
  section_id?: number;
  secondary_subject_ids?: number[];
  secondary_section_ids?: number[];
  experience?: number;
  age?: number;
  onboarding_date?: string;
  school_tenure?: number;
  device_type?: string;
  device_access?: Record<string, boolean>;
  ppt_generation_enabled?: boolean;
  cost_limit?: number;
  qualification?: string;
}

interface ResolvedIds {
  resolvedClassId:   number | null;
  resolvedSubjectId: number | null;
  resolvedSectionId: number | null;
}

export class TeacherService {

  private async resolveClassSubjectSection(
    { class_name, subject_name, section_name }: { class_name?: string; subject_name?: string; section_name?: string },
    school: any,
    transaction?: any
  ): Promise<ResolvedIds> {
    let resolvedClassId:   number | null = null;
    let resolvedSubjectId: number | null = null;
    let resolvedSectionId: number | null = null;

    if (!class_name) return { resolvedClassId, resolvedSubjectId, resolvedSectionId };

    const classRecord = await teacherRepository.findClassByName(class_name, transaction);
    if (!classRecord) return { resolvedClassId, resolvedSubjectId, resolvedSectionId };
    resolvedClassId = (classRecord as any).class_id;

    if (subject_name) {
      const subjectRecord = await teacherRepository.findSubjectByParams({
        class_id:     resolvedClassId!,
        subject_name,
        board:        school.board,
        language:     school.language_preference,
      }, transaction);
      resolvedSubjectId = (subjectRecord as any)?.subject_id ?? null;
    }

    if (section_name) {
      const sectionRecord = await teacherRepository.findSectionByName(resolvedClassId!, section_name, transaction);
      resolvedSectionId = (sectionRecord as any)?.section_id ?? null;
    }

    return { resolvedClassId, resolvedSubjectId, resolvedSectionId };
  }

  private async buildAndInsertAssignments(
    teacherId: number | string,
    {
      primary_subject_id,
      section_id,
      secondary_subject_ids,
      secondary_section_ids,
    }: {
      primary_subject_id?: number | null;
      section_id?: number | null;
      secondary_subject_ids?: number[];
      secondary_section_ids?: number[];
    },
    transaction?: any
  ): Promise<Record<string, any>[]> {
    const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const assignmentRows: Record<string, any>[] = [];

    if (primary_subject_id && section_id) {
      const primarySubject = await teacherRepository.findSubjectById(primary_subject_id, transaction);
      if (primarySubject) {
        assignmentRows.push({
          teacher_id:       Number(teacherId),
          class_id:         (primarySubject as any).class_id,
          section_id:       Number(section_id),
          class_subject_id: Number(primary_subject_id),
          academic_year:    academicYear,
        });
      }
    }

    if (Array.isArray(secondary_subject_ids) && secondary_subject_ids.length) {
      const secSubjects = await teacherRepository.findSubjectsByIds(secondary_subject_ids, transaction);
      for (let i = 0; i < secondary_subject_ids.length; i++) {
        const subjectId       = Number(secondary_subject_ids[i]);
        const sectionIdForSub = secondary_section_ids?.[i] ? Number(secondary_section_ids[i]) : null;
        const subjectRecord   = secSubjects.find((s) => Number((s as any).subject_id) === subjectId);
        if (!subjectRecord || !sectionIdForSub) continue;
        assignmentRows.push({
          teacher_id:       Number(teacherId),
          class_id:         (subjectRecord as any).class_id,
          section_id:       sectionIdForSub,
          class_subject_id: subjectId,
          academic_year:    academicYear,
        });
      }
    }

    await teacherRepository.bulkCreateAssignments(assignmentRows, transaction);
    return assignmentRows;
  }

  async createTeacher(input: CreateTeacherInput): Promise<{ teacher: TeacherProfile; secondarySubjects: AdminSubject[] }> {
    const {
      school_id, username, password, phone_number, email, full_name, gender, preferred_language,
      class_name, subject_name, section_name,
      primary_subject_id, section_id,
      secondary_subject_ids, secondary_section_ids,
      experience, age, onboarding_date, school_tenure,
      device_type, device_access, ppt_generation_enabled, cost_limit, qualification,
    } = input;

    if (!username || !password) throw new ApiError(400, "Username and password required");

    const school = await teacherRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    const transaction = await sequelize.transaction();

    try {
      const role = await teacherRepository.findRoleByName("TEACHER", transaction);
      if (!role) throw new ApiError(400, "Teacher role not found");

      let finalSubjectId = primary_subject_id || null;
      let finalSectionId = section_id         || null;

      if (!finalSubjectId && class_name) {
        const resolved = await this.resolveClassSubjectSection({ class_name, subject_name, section_name }, school, transaction);
        finalSubjectId = resolved.resolvedSubjectId;
        finalSectionId = resolved.resolvedSectionId;
      }

      const hashed = await bcrypt.hash(password, 10);

      const user = await teacherRepository.createUser({
        username,
        full_name:                  full_name    || null,
        password:                   hashed,
        phone_number:               phone_number || null,
        email:                      email        || null,
        role_id:                    (role as any).role_id,
        school_id,
        status:                     "Active",
        is_password_reset_required: true,
      }, transaction);

      const teacher = await teacherRepository.createTeacherProfile({
        user_id:                user.user_id,
        school_id,
        primary_subject_id:     finalSubjectId        || null,
        secondary_subject_ids:  secondary_subject_ids || null,
        experience:             experience             || null,
        age:                    age                    || null,
        onboarding_date:        onboarding_date        || null,
        school_tenure:          school_tenure          || null,
        device_type:            device_type            || null,
        device_access:          device_access          || null,
        ppt_generation_enabled: ppt_generation_enabled ?? false,
        cost_limit:             cost_limit             || null,
        qualification:          qualification          || null,
        gender:                 gender                 || null,
        preferred_language:     preferred_language     || null,
      }, transaction);

      await this.buildAndInsertAssignments(
        (teacher as any).teacher_id,
        {
          primary_subject_id:    finalSubjectId,
          section_id:            finalSectionId,
          secondary_subject_ids: secondary_subject_ids || [],
          secondary_section_ids: secondary_section_ids || [],
        },
        transaction
      );

      await teacherRepository.incrementSchoolTeacherCount(school_id, 1, transaction);
      await transaction.commit();

      const created = await teacherRepository.findTeacherById((teacher as any).teacher_id);
      const secondarySubjects = await teacherRepository.findSecondarySubjects((created as any).secondary_subject_ids);

      return { teacher: created!, secondarySubjects };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async bulkTeacherUpload(filePath: string, school_id: number | bigint): Promise<{ created: number }> {
    const school = await teacherRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(400, "School not found");

    const records = parseExcel(filePath);
    if (!records.length) throw new ApiError(400, "Excel file is empty");

    const transaction = await sequelize.transaction();

    try {
      const role = await teacherRepository.findRoleByName("TEACHER", transaction);
      if (!role) throw new ApiError(400, "Teacher role not found");

      let createdCount = 0;

      for (const [index, row] of (records as any[]).entries()) {
        const rowLabel = `Row ${index + 2}`;

        if (!row.username || !row.password)
          throw new ApiError(400, `${rowLabel}: Missing username or password`);

        let resolvedSubjectId: number | null = null;
        let resolvedSectionId: number | null = null;

        if (row.class_name) {
          const classRecord = await teacherRepository.findClassByName(row.class_name, transaction);
          if (classRecord) {
            const resolvedClassId = (classRecord as any).class_id;

            if (row.subject_name) {
              const subjectRecord = await teacherRepository.findSubjectByParams({
                class_id:     resolvedClassId,
                subject_name: row.subject_name,
                board:        (school as any).board,
                language:     (school as any).language_preference,
              }, transaction);
              resolvedSubjectId = (subjectRecord as any)?.subject_id ?? null;
            }

            if (row.section_name) {
              const sectionRecord = await teacherRepository.findSectionByName(resolvedClassId, row.section_name, transaction);
              resolvedSectionId = (sectionRecord as any)?.section_id ?? null;
            }
          }
        }

        const hashed = await bcrypt.hash(String(row.password), 10);

        const user = await teacherRepository.createUser({
          username:                   row.username,
          full_name:                  row.full_name    || null,
          password:                   hashed,
          phone_number:               row.phone_number || null,
          email:                      row.email        || null,
          role_id:                    (role as any).role_id,
          school_id,
          status:                     "Active",
          is_password_reset_required: true,
        }, transaction);

        const teacher = await teacherRepository.createTeacherProfile({
          user_id:                user.user_id,
          school_id,
          primary_subject_id:     resolvedSubjectId         || null,
          secondary_subject_ids:  null,
          experience:             row.experience            || null,
          age:                    row.age                   || null,
          onboarding_date:        row.onboarding_date       || null,
          school_tenure:          row.school_tenure         || null,
          device_type:            row.device_type           || null,
          device_access:          row.device_access         || null,
          ppt_generation_enabled: row.ppt_generation_enabled ?? false,
          cost_limit:             row.cost_limit            || null,
          qualification:          row.qualification         || null,
          gender:                 row.gender                || null,
          preferred_language:     row.preferred_language    || null,
        }, transaction);

        await this.buildAndInsertAssignments(
          (teacher as any).teacher_id,
          {
            primary_subject_id:    resolvedSubjectId || null,
            section_id:            resolvedSectionId || null,
            secondary_subject_ids: [],
            secondary_section_ids: [],
          },
          transaction
        );

        createdCount++;
      }

      await teacherRepository.incrementSchoolTeacherCount(school_id, createdCount, transaction);
      await transaction.commit();
      fs.unlinkSync(filePath);

      return { created: createdCount };
    } catch (error) {
      await transaction.rollback();
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw error;
    }
  }

  async getAllTeachers(school_id: number | bigint): Promise<Array<TeacherProfile & { secondarySubjects: AdminSubject[] }>> {
    const teachers = await teacherRepository.findAllTeachers(school_id);

    return Promise.all(
      teachers.map(async (teacher) => {
        const secondarySubjects = await teacherRepository.findSecondarySubjects((teacher as any).secondary_subject_ids);
        return { ...(teacher as any).toJSON(), secondarySubjects };
      })
    );
  }

  async getTeacherById(id: number | string | bigint): Promise<TeacherProfile & { secondarySubjects: AdminSubject[] }> {
    const teacher = await teacherRepository.findTeacherById(id);
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const secondarySubjects = await teacherRepository.findSecondarySubjects((teacher as any).secondary_subject_ids);
    return { ...(teacher as any).toJSON(), secondarySubjects };
  }

  async updateTeacher(
    id: number | string | bigint,
    body: Record<string, any>
  ): Promise<TeacherProfile & { secondarySubjects: AdminSubject[] }> {
    const teacher = await teacherRepository.findTeacherRaw(id);
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const school = await teacherRepository.findSchoolById((teacher as any).school_id);

    const {
      user_id, school_id,
      class_name, subject_name, section_name,
      primary_subject_id, section_id,
      secondary_subject_ids, secondary_section_ids,
      ...profileUpdates
    } = body;

    const transaction = await sequelize.transaction();

    try {
      let finalSubjectId = primary_subject_id ?? undefined;
      let finalSectionId = section_id         ?? undefined;

      if (class_name) {
        const resolved = await this.resolveClassSubjectSection({ class_name, subject_name, section_name }, school, transaction);
        finalSubjectId = resolved.resolvedSubjectId;
        finalSectionId = resolved.resolvedSectionId;
      }

      await teacherRepository.updateTeacher(teacher, {
        ...profileUpdates,
        ...(finalSubjectId        !== undefined && { primary_subject_id: finalSubjectId }),
        ...(secondary_subject_ids !== undefined && { secondary_subject_ids }),
      }, transaction);

      const hasAssignmentData =
        finalSubjectId        !== undefined ||
        finalSectionId        !== undefined ||
        secondary_subject_ids !== undefined ||
        secondary_section_ids !== undefined;

      if (hasAssignmentData) {
        await teacherRepository.deleteAssignmentsByTeacher(id, transaction);
        await this.buildAndInsertAssignments(
          id as any,
          {
            primary_subject_id:    finalSubjectId    ?? (teacher as any).primary_subject_id,
            section_id:            finalSectionId,
            secondary_subject_ids: secondary_subject_ids ?? (teacher as any).secondary_subject_ids,
            secondary_section_ids,
          },
          transaction
        );
      }

      await transaction.commit();

      const updated = await teacherRepository.findTeacherById(id);
      const secondarySubjects = await teacherRepository.findSecondarySubjects((updated as any).secondary_subject_ids);
      return { ...(updated as any).toJSON(), secondarySubjects };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async deleteTeacher(id: number | string | bigint): Promise<void> {
    const teacher = await teacherRepository.findTeacherRaw(id);
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const { school_id, user_id } = teacher as any;
    await teacherRepository.deleteTeacherWithRelated(id, user_id, school_id);
  }
}

export const teacherService = new TeacherService();
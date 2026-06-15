import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";
import { ApiError } from "../utils/ApiError.js";
import { parseExcel } from "../utils/excel.util.js";
import { studentRepository } from "../repositories/student.repository.js";
import StudentProfile from "../models/student_profile.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import { generatePassword } from "../utils/password.util.js";
import { generateUsername } from "../utils/username.util.js";
import { sendWelcomeEmail } from "../utils/mailer.util.js";
import curriculumService from "./curriculum.service.js";

const VALID_RELATIONS = ["father", "mother", "guardian"];
const VALID_GENDERS = ["male", "female", "other"];
const GENERAL_STREAM_ID = 4;
const STREAM_REQUIRED_FROM_GRADE = 11;

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface CreateStudentInput {
  student_full_name: string;
  student_phone: string;
  class_name: string;
  section_name: string;
  stream?: string | null;
  stream_id?: number | null;
  student_email?: string;
  student_address?: string;
  gender?: string;
  roll_number?: string;
  academic_year?: string;
  preferred_language?: string;
  onboarding_date?: string;
  cost_limit?: number;
  dob?: string;
  analytics_enabled?: boolean;
  parent_full_name: string;
  parent_phone: string;
  parent_email?: string;
  parent_address?: string;
  relation?: string;
  school_id: number | bigint;
}

interface UpdateStudentInput {
  // User-level fields
  full_name?: string;
  phone_number?: string;
  email?: string;
  address?: string;
  // Profile-level fields
  gender?: string;
  status?: string;
  preferred_language?: string;
  onboarding_date?: string;
  cost_limit?: number;
  dob?: string;
  analytics_enabled?: boolean;
  [key: string]: any;
}

// ─── Name / validation helpers ─────────────────────────────────────────────────

function toNameCase(str: string): string {
  return str
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function isValidPhone(phone: string | number): boolean {
  return /^\d{10}$/.test(String(phone).trim());
}

function validateClassName(raw: string): { normalised: string; gradeNumber: number } {
  const trimmed = raw.trim();
  if (/^(class|std|standard)\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7").`);
  if (/^\d+$/.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7").`);
  if (!/^Grade\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Must match "Grade <number>" (e.g. "Grade 10").`);

  const normalised = trimmed.replace(/^grade/i, "Grade");
  const gradeNumber = parseInt(normalised.split(/\s+/)[1], 10);
  return { normalised, gradeNumber };
}

function validateStream(
  rawStreamName: string | null | undefined,
  gradeNumber: number,
  allStreams: any[],
  className: string,
): { id: number; name: string } {
  if (gradeNumber < STREAM_REQUIRED_FROM_GRADE) {
    const generalStream = allStreams.find((s: any) => Number(s.id) === GENERAL_STREAM_ID);
    return { id: GENERAL_STREAM_ID, name: generalStream?.stream_name ?? "General" };
  }

  const validStreams = allStreams.filter((s: any) => Number(s.id) !== GENERAL_STREAM_ID);
  const validNames = validStreams.map((s: any) => s.stream_name).join(", ");

  if (!rawStreamName || !String(rawStreamName).trim()) {
    throw new Error(
      `stream is required for "${className}". ` +
      `Please provide the stream for this class. Valid options: ${validNames}`
    );
  }

  const normalised = String(rawStreamName).trim().toLowerCase();

  const generalStream = allStreams.find((s: any) => Number(s.id) === GENERAL_STREAM_ID);
  if (generalStream && normalised === String(generalStream.stream_name).trim().toLowerCase()) {
    throw new Error(
      `"${rawStreamName}" stream is only for classes below Grade ${STREAM_REQUIRED_FROM_GRADE}. ` +
      `Valid options for ${className}: ${validNames}`
    );
  }

  const streamRecord = allStreams.find(
    (s: any) => String(s.stream_name).trim().toLowerCase() === normalised,
  );

  if (!streamRecord) {
    throw new Error(
      `Stream "${rawStreamName}" not found. You entered "${rawStreamName}" — ` +
      `valid streams for ${className}: ${validNames}`
    );
  }

  return { id: Number(streamRecord.id), name: streamRecord.stream_name };
}

function parseFlexibleDate(value: any, fieldName: string): string | null {
  console.log(`[DateParser] field="${fieldName}" | type=${typeof value} | value=${JSON.stringify(value)} | isDate=${value instanceof Date}`);

  if (value === undefined || value === null || value === "") {
    console.log(`[DateParser] field="${fieldName}" → null (empty/undefined)`);
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1)
      throw new Error(`Invalid date serial "${value}" in "${fieldName}".`);
    const MS_PER_DAY = 86400000;
    const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
    const ms = EXCEL_EPOCH_UTC + value * MS_PER_DAY;
    const d = new Date(ms);
    if (isNaN(d.getTime()))
      throw new Error(`Cannot decode Excel date serial "${value}" in "${fieldName}".`);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    console.log(`[DateParser] field="${fieldName}" | serial=${value} → iso="${iso}" ✓`);
    return iso;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime()))
      throw new Error(`Invalid date in "${fieldName}". The cell contained an unreadable date value.`);
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    console.log(`[DateParser] field="${fieldName}" | JS Date → iso="${iso}" ✓`);
    return iso;
  }

  const str = String(value).trim();
  const match = str.match(/^(\d{1,4})([-\/\.])(\d{1,2})\2(\d{1,4})$/);
  if (!match)
    throw new Error(
      `Invalid date "${str}" in "${fieldName}". ` +
      `Accepted formats: DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD (separators: - / .)`,
    );

  const p1 = parseInt(match[1], 10);
  const p2 = parseInt(match[3], 10);
  const p3 = parseInt(match[4], 10);

  let year: number, month: number, day: number;

  if (p1 > 31) {
    year = p1;
    if (p2 > 12) { day = p2; month = p3; }
    else { month = p2; day = p3; }
  } else if (p3 > 31) {
    year = p3;
    if (p1 > 12) { day = p1; month = p2; }
    else if (p2 > 12) { month = p1; day = p2; }
    else { month = p1; day = p2; }
  } else {
    throw new Error(`Cannot determine year in date "${str}" for "${fieldName}". Use a 4-digit year.`);
  }

  if (month < 1 || month > 12)
    throw new Error(`Invalid month ${month} parsed from date "${str}" in "${fieldName}".`);
  if (day < 1 || day > 31)
    throw new Error(`Invalid day ${day} parsed from date "${str}" in "${fieldName}".`);

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (isNaN(Date.parse(iso)))
    throw new Error(`Date "${str}" in "${fieldName}" resolves to an invalid calendar date (${iso}).`);

  console.log(`[DateParser] field="${fieldName}" | str="${str}" → iso="${iso}" ✓`);
  return iso;
}

// ─── Curriculum pre-fetch helper ───────────────────────────────────────────────

async function fetchCurriculumData(): Promise<{
  allClasses: any[];
  allSections: any[];
  allStreams: any[];
}> {
  try {
    const [classesRes, sectionsRes, streamsRes] = await Promise.all([
      curriculumService.allClass(),
      curriculumService.section(),
      curriculumService.stream(),
    ]);
    return {
      allClasses: classesRes?.data ?? classesRes ?? [],
      allSections: sectionsRes?.data ?? sectionsRes ?? [],
      allStreams: streamsRes?.data ?? streamsRes ?? [],
    };
  } catch {
    throw new ApiError(503, "Curriculum service unavailable");
  }
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class StudentService {

  // ─── Single create ───────────────────────────────────────────────────────────
  async createStudent(input: CreateStudentInput): Promise<StudentProfile> {
    const {
      student_full_name, student_phone, student_email, student_address,
      class_name, section_name, stream, stream_id,
      roll_number, academic_year,
      gender, preferred_language, onboarding_date, cost_limit, dob, analytics_enabled,
      parent_full_name, parent_phone, parent_email, parent_address,
      relation, school_id,
    } = input;

    // ── 1. Mandatory field check ──────────────────────────────────────────────
    const missing: string[] = [];
    if (!student_full_name) missing.push("student_full_name");
    if (!student_phone) missing.push("student_phone");
    if (!class_name) missing.push("class_name");
    if (!section_name) missing.push("section_name");
    if (!parent_full_name) missing.push("parent_full_name");
    if (!parent_phone) missing.push("parent_phone");
    if (missing.length) throw new ApiError(400, `Missing required fields: ${missing.join(", ")}`);

    // ── 2. Normalise names ────────────────────────────────────────────────────
    const normStudentName = toNameCase(student_full_name);
    const normParentName = toNameCase(parent_full_name);

    const school = await studentRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    // ── 3. Fetch curriculum data ──────────────────────────────────────────────
    const { allClasses, allSections, allStreams } = await fetchCurriculumData();

    // ── 4. Resolve class ──────────────────────────────────────────────────────
    const { normalised: normalizedClassName, gradeNumber } = validateClassName(class_name);
    const classRecord = allClasses.find((c: any) => c.class_name === normalizedClassName);
    if (!classRecord)
      throw new ApiError(400, `Class "${normalizedClassName}" does not exist. Please create it first.`);
    const resolvedClassId: number = classRecord.id;

    // ── 5. Resolve section ────────────────────────────────────────────────────
    const normalizedSectionName = section_name.trim().toUpperCase();
    const sectionRecord = allSections.find((s: any) => s.section_name === normalizedSectionName);
    if (!sectionRecord)
      throw new ApiError(400, `Section "${normalizedSectionName}" does not exist. Please create it first.`);
    const resolvedSectionId: number = sectionRecord.id;

    // ── 6. Resolve stream ─────────────────────────────────────────────────────
    let resolvedStreamId: number;
    try {
      const rawStream = stream?.trim() || (stream_id != null ? String(stream_id) : null);
      const streamResult = validateStream(rawStream, gradeNumber, allStreams, normalizedClassName);
      resolvedStreamId = streamResult.id;
    } catch (e: any) {
      throw new ApiError(400, e.message);
    }

    // ── 7. Enum validations ───────────────────────────────────────────────────
    const normalizedRelation = relation?.toLowerCase() || null;
    const normalizedGender = gender?.toLowerCase() || null;
    if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);
    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    const plainStudentPassword = "Student@123";
    const plainParentPassword = "Parent@123";
    const studentUsername = generateUsername(normStudentName);
    const parentUsername = generateUsername(normParentName);

    const transaction = await sequelize.transaction();
    try {
      const [studentRole, parentRole] = await Promise.all([
        studentRepository.findRoleByName("STUDENT", transaction),
        studentRepository.findRoleByName("PARENT", transaction),
      ]);
      if (!studentRole || !parentRole) throw new ApiError(400, "Student or Parent role missing");

      const resolvedParentPhone = parent_phone || student_phone;
      const resolvedParentAddress = parent_address || student_address || null;

      // ── Parent ───────────────────────────────────────────────────────────────
      const parentHashed = await bcrypt.hash(plainParentPassword, 10);
      const parentUser = await studentRepository.createUser({
        username: parentUsername,
        full_name: normParentName,
        password: parentHashed,
        phone_number: resolvedParentPhone,
        email: parent_email || null,
        address: resolvedParentAddress,
        role_id: parentRole.role_id,
        school_id, status: "Active",
        is_password_reset_required: true,
      }, transaction);

      const parent = await studentRepository.createParentProfile({
        user_id: parentUser.user_id, school_id, relation: normalizedRelation,
      }, transaction);

      // ── Student ──────────────────────────────────────────────────────────────
      const studentHashed = await bcrypt.hash(plainStudentPassword, 10);
      const studentUser = await studentRepository.createUser({
        username: studentUsername,
        full_name: normStudentName,
        password: studentHashed,
        phone_number: student_phone,
        email: student_email || null,
        address: student_address || null,
        role_id: studentRole.role_id,
        school_id, status: "Active",
        is_password_reset_required: true,
      }, transaction);

      const student = await studentRepository.createStudentProfile({
        user_id: studentUser.user_id,
        school_id,
        preferred_language: preferred_language || null,
        onboarding_date: onboarding_date || null,
        cost_limit: cost_limit || null,
        dob: dob || null,
        gender: normalizedGender,
        analytics_enabled: analytics_enabled ?? false,
      }, transaction);

      // ── Assign class in curriculum microservice ───────────────────────────
      try {
        await curriculumService.assignClass({
          userId: Number(studentUser.user_id),
          schoolId: Number(school_id),
          classId: resolvedClassId,
          streamId: resolvedStreamId,
          sectionId: resolvedSectionId,
        });
      } catch (e: any) {
        throw new ApiError(503, `Failed to assign class in curriculum service: ${e?.message ?? "unknown error"}`);
      }

      // ── Local enrolment row ───────────────────────────────────────────────
      await studentRepository.createParentStudentMap(
        { parent_id: BigInt((parent as any).parent_id), student_id: BigInt(student.student_id) },
        transaction,
      );
      await studentRepository.createClassSection({
        student_id: student.student_id,
        class_id: resolvedClassId,
        section_id: resolvedSectionId,
        stream_id: resolvedStreamId,
        roll_number: roll_number || null,
        academic_year: academic_year || null,
        status: "active",
      }, transaction);
      await studentRepository.incrementSchoolStudentCount(school_id, 1, transaction);
      await transaction.commit();

      if (student_email) sendWelcomeEmail(student_email, normStudentName, studentUsername, plainStudentPassword)
        .catch((e) => console.error("[Mailer] Student welcome email failed:", e));
      if (parent_email) sendWelcomeEmail(parent_email, normParentName, parentUsername, plainParentPassword)
        .catch((e) => console.error("[Mailer] Parent welcome email failed:", e));

      return student;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ─── Bulk Upload ─────────────────────────────────────────────────────────────
  async bulkStudentUpload(
    filePath: string,
    school_id: number | bigint,
  ): Promise<{ created: number; updated: number; failed: number; errors: Array<{ row: string; message: string }> }> {

    const records = parseExcel(filePath);
    if (!records.length) throw new ApiError(400, "Excel file is empty");

    const [studentRole, parentRole] = await Promise.all([
      studentRepository.findRoleByName("STUDENT"),
      studentRepository.findRoleByName("PARENT"),
    ]);
    if (!studentRole || !parentRole) throw new ApiError(400, "Student or Parent role missing");

    const { allClasses, allSections, allStreams } = await fetchCurriculumData();

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const rowErrors: Array<{ row: string; message: string }> = [];
    const emailQueue: Array<{ to: string; name: string; username: string; password: string }> = [];

    for (const [index, row] of (records as any[]).entries()) {
      const rowLabel = `Row ${index + 2}`;
      const tx = await sequelize.transaction();

      try {
        // ── 1. Mandatory fields ──────────────────────────────────────────────
        const rowMissing: string[] = [];
        if (!row.student_full_name) rowMissing.push("student_full_name");
        if (!row.student_phone) rowMissing.push("student_phone");
        if (!row.parent_full_name) rowMissing.push("parent_full_name");
        if (!row.parent_phone) rowMissing.push("parent_phone");
        if (!row.class_name) rowMissing.push("class_name");
        if (!row.section_name) rowMissing.push("section_name");
        if (rowMissing.length) throw new Error(`Missing required fields: ${rowMissing.join(", ")}`);

        // ── 2. Normalise names ───────────────────────────────────────────────
        const studentFullName = toNameCase(String(row.student_full_name));
        const parentFullName = toNameCase(String(row.parent_full_name));

        // ── 3. Phone validation ──────────────────────────────────────────────
        if (!isValidPhone(row.student_phone))
          throw new Error(`student_phone "${row.student_phone}" must be exactly 10 digits.`);
        if (row.parent_phone && !isValidPhone(row.parent_phone))
          throw new Error(`parent_phone "${row.parent_phone}" must be exactly 10 digits.`);

        const studentPhone = String(row.student_phone).trim();
        const parentPhone = String(row.parent_phone || row.student_phone).trim();

        // ── 4. class_name validation ─────────────────────────────────────────
        const { normalised: normalizedClassName, gradeNumber } = validateClassName(String(row.class_name));

        // ── 5. section_name → UPPERCASE ──────────────────────────────────────
        const normalizedSectionName = String(row.section_name).trim().toUpperCase();

        // ── 6. stream ────────────────────────────────────────────────────────
        const streamResult = validateStream(
          row.stream ?? null,
          gradeNumber,
          allStreams,
          normalizedClassName,
        );
        const resolvedStreamId = streamResult.id;

        // ── 7. Flexible date parsing ──────────────────────────────────────────
        const validatedDob = parseFlexibleDate(row.dob, "dob");
        const validatedOnboardingDate = parseFlexibleDate(row.onboarding_date, "onboarding_date");

        // ── 8. Enum validation ────────────────────────────────────────────────
        const normalizedRelation = row.relation ? String(row.relation).toLowerCase() : null;
        const normalizedGender = row.gender ? String(row.gender).toLowerCase() : null;
        if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
          throw new Error(`Invalid relation "${row.relation}". Must be one of: ${VALID_RELATIONS.join(", ")}`);
        if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
          throw new Error(`Invalid gender "${row.gender}". Must be one of: ${VALID_GENDERS.join(", ")}`);

        // ── 9. Email normalisation ────────────────────────────────────────────
        const studentEmailRaw = row.student_email ? String(row.student_email).trim().toLowerCase() : null;
        const parentEmailRaw = row.parent_email ? String(row.parent_email).trim().toLowerCase() : null;

        // ── 10. Resolve class ─────────────────────────────────────────────────
        const classRecord = allClasses.find((c: any) => c.class_name === normalizedClassName);
        if (!classRecord)
          throw new Error(`Class "${normalizedClassName}" does not exist. Please create it first.`);
        const resolvedClassId: number = classRecord.id;

        // ── 11. Resolve section ───────────────────────────────────────────────
        const sectionRecord = allSections.find((s: any) => s.section_name === normalizedSectionName);
        if (!sectionRecord)
          throw new Error(`Section "${normalizedSectionName}" does not exist. Please create it first.`);
        const resolvedSectionId: number = sectionRecord.id;

        // ── 12. Student upsert ────────────────────────────────────────────────
        let student: StudentProfile;
        let isNewStudent = false;
        let plainStudentPassword = "";
        let studentUsername = "";
        let studentUserId: number | bigint;

        const existingStudentUser = await studentRepository.findUserByNamePhoneAndRole(
          studentFullName,
          studentPhone,
          studentRole.role_id,
          tx,
        );

        if (existingStudentUser) {
          const existingStudent = await studentRepository.findStudentProfileByUserId(
            (existingStudentUser as any).user_id, tx,
          );
          if (!existingStudent)
            throw new Error(
              `User "${studentFullName}" (${studentPhone}) exists but has no StudentProfile. ` +
              `Please check their account manually.`,
            );

          const userUpdates: Record<string, any> = {};
          if (studentEmailRaw !== undefined && studentEmailRaw !== (existingStudentUser as any).email)
            userUpdates.email = studentEmailRaw;
          if (row.student_address !== undefined && row.student_address !== (existingStudentUser as any).address)
            userUpdates.address = row.student_address || null;

          const profileUpdates: Record<string, any> = {};
          if (normalizedGender && normalizedGender !== (existingStudent as any).gender)
            profileUpdates.gender = normalizedGender;
          if (validatedDob && validatedDob !== (existingStudent as any).dob?.toISOString?.().slice(0, 10))
            profileUpdates.dob = validatedDob;
          if (validatedOnboardingDate && validatedOnboardingDate !== (existingStudent as any).onboarding_date?.toISOString?.().slice(0, 10))
            profileUpdates.onboarding_date = validatedOnboardingDate;
          if (row.preferred_language !== undefined && row.preferred_language !== (existingStudent as any).preferred_language)
            profileUpdates.preferred_language = row.preferred_language || null;
          if (row.cost_limit !== undefined && row.cost_limit !== (existingStudent as any).cost_limit)
            profileUpdates.cost_limit = row.cost_limit || null;
          if (row.analytics_enabled !== undefined && row.analytics_enabled !== (existingStudent as any).analytics_enabled)
            profileUpdates.analytics_enabled = row.analytics_enabled ?? false;

          if (Object.keys(userUpdates).length)
            await studentRepository.updateUser((existingStudentUser as any).user_id, userUpdates, tx);
          if (Object.keys(profileUpdates).length)
            await studentRepository.updateStudentProfile((existingStudent as any).student_id, profileUpdates, tx);

          student = existingStudent;
          studentUserId = (existingStudentUser as any).user_id;
        } else {
          isNewStudent = true;
          plainStudentPassword = generatePassword();
          studentUsername = generateUsername(studentFullName);

          const studentHashed = await bcrypt.hash(plainStudentPassword, 10);
          const studentUser = await studentRepository.createUser({
            username: studentUsername,
            full_name: studentFullName,
            password: studentHashed,
            phone_number: studentPhone,
            email: studentEmailRaw || null,
            address: row.student_address || null,
            role_id: studentRole.role_id,
            school_id, status: "Active",
            is_password_reset_required: true,
          }, tx);

          student = await studentRepository.createStudentProfile({
            user_id: studentUser.user_id,
            school_id,
            preferred_language: row.preferred_language || null,
            onboarding_date: validatedOnboardingDate,
            cost_limit: row.cost_limit || null,
            dob: validatedDob,
            gender: normalizedGender,
            analytics_enabled: row.analytics_enabled ?? false,
          }, tx);

          studentUserId = studentUser.user_id;
          await studentRepository.incrementSchoolStudentCount(school_id, 1, tx);
        }

        // ── 13. Assign class in curriculum microservice ───────────────────────
        try {
          await curriculumService.assignClass({
            userId: Number(studentUserId),
            schoolId: Number(school_id),
            classId: resolvedClassId,
            streamId: resolvedStreamId,
            sectionId: resolvedSectionId,
          });
        } catch (e: any) {
          throw new Error(`Failed to assign class in curriculum service: ${e?.message ?? "unknown error"}`);
        }

        // ── 14. Local enrolment upsert ────────────────────────────────────────
        const existingEnrolment = await studentRepository.findClassSectionEnrolmentByStudent(
          student.student_id, tx,
        );

        if (existingEnrolment) {
          const enrolmentUpdates: Record<string, any> = {};
          if (resolvedClassId !== (existingEnrolment as any).class_id)
            enrolmentUpdates.class_id = resolvedClassId;
          if (resolvedSectionId !== (existingEnrolment as any).section_id)
            enrolmentUpdates.section_id = resolvedSectionId;
          if (resolvedStreamId !== ((existingEnrolment as any).stream_id ?? null))
            enrolmentUpdates.stream_id = resolvedStreamId;
          if (row.roll_number !== undefined &&
            String(row.roll_number || "") !== String((existingEnrolment as any).roll_number || ""))
            enrolmentUpdates.roll_number = row.roll_number || null;
          if (row.academic_year !== undefined &&
            String(row.academic_year || "") !== String((existingEnrolment as any).academic_year || ""))
            enrolmentUpdates.academic_year = row.academic_year || null;
          if ((existingEnrolment as any).status !== "active")
            enrolmentUpdates.status = "active";

          if (Object.keys(enrolmentUpdates).length)
            await studentRepository.updateClassSectionEnrolmentByStudent(
              student.student_id, enrolmentUpdates, tx,
            );
        } else {
          await studentRepository.createClassSection({
            student_id: student.student_id,
            class_id: resolvedClassId,
            section_id: resolvedSectionId,
            stream_id: resolvedStreamId,
            roll_number: row.roll_number || null,
            academic_year: row.academic_year || null,
            status: "active",
          }, tx);
        }

        // ── 15. Parent upsert ─────────────────────────────────────────────────
        let parent: any;
        let isNewParent = false;
        let plainParentPassword = "";
        let parentUsername = "";

        const existingParentUser = await studentRepository.findUserByNamePhoneAndRole(
          parentFullName,
          parentPhone,
          parentRole.role_id,
          tx,
        );

        if (existingParentUser) {
          const existingParent = await studentRepository.findParentProfileByUserId(
            (existingParentUser as any).user_id, tx,
          );
          if (!existingParent)
            throw new Error(
              `User "${parentFullName}" (${parentPhone}) exists but has no ParentProfile. ` +
              `Please check their account manually.`,
            );

          const parentUserUpdates: Record<string, any> = {};
          if (parentEmailRaw !== undefined && parentEmailRaw !== (existingParentUser as any).email)
            parentUserUpdates.email = parentEmailRaw;
          const resolvedParentAddress = row.parent_address || row.student_address || null;
          if (resolvedParentAddress !== undefined && resolvedParentAddress !== (existingParentUser as any).address)
            parentUserUpdates.address = resolvedParentAddress;

          const parentProfileUpdates: Record<string, any> = {};
          if (normalizedRelation && normalizedRelation !== (existingParent as any).relation)
            parentProfileUpdates.relation = normalizedRelation;

          if (Object.keys(parentUserUpdates).length)
            await studentRepository.updateUser((existingParentUser as any).user_id, parentUserUpdates, tx);
          if (Object.keys(parentProfileUpdates).length)
            await studentRepository.updateParentProfile((existingParent as any).parent_id, parentProfileUpdates, tx);

          parent = existingParent;
        } else {
          isNewParent = true;
          plainParentPassword = generatePassword();
          parentUsername = generateUsername(parentFullName);

          const resolvedParentAddress = row.parent_address || row.student_address || null;
          const parentHashed = await bcrypt.hash(plainParentPassword, 10);

          const parentUser = await studentRepository.createUser({
            username: parentUsername,
            full_name: parentFullName,
            password: parentHashed,
            phone_number: parentPhone,
            email: parentEmailRaw || null,
            address: resolvedParentAddress,
            role_id: parentRole.role_id,
            school_id, status: "Active",
            is_password_reset_required: true,
          }, tx);

          parent = await studentRepository.createParentProfile({
            user_id: parentUser.user_id,
            school_id,
            relation: normalizedRelation,
          }, tx);
        }

        // ── 16. Parent ↔ student mapping ──────────────────────────────────────
        const mappingExists = await studentRepository.findParentStudentMapping(
          BigInt(parent.parent_id), BigInt(student.student_id), tx,
        );
        if (!mappingExists) {
          await studentRepository.createParentStudentMap(
            { parent_id: BigInt(parent.parent_id), student_id: BigInt(student.student_id) }, tx,
          );
        }

        await tx.commit();

        if (isNewStudent || isNewParent) {
          createdCount++;
        } else {
          updatedCount++;
        }

        if (isNewStudent && studentEmailRaw)
          emailQueue.push({ to: studentEmailRaw, name: studentFullName, username: studentUsername, password: plainStudentPassword });
        if (isNewParent && parentEmailRaw)
          emailQueue.push({ to: parentEmailRaw, name: parentFullName, username: parentUsername, password: plainParentPassword });

      } catch (err: any) {
        await tx.rollback();
        failedCount++;

        const sqlMsg = err?.parent?.sqlMessage;
        const rawMsg: string = sqlMsg ?? err?.message ?? "Unknown error";

        console.error(`\n[BulkUpload] ❌ ${rowLabel} FAILED`);
        console.error(`[BulkUpload]   Error type   : ${err?.name ?? typeof err}`);
        console.error(`[BulkUpload]   Message      : ${rawMsg}`);

        if (sqlMsg) {
          console.error(`[BulkUpload]   SQL errno    : ${err?.parent?.errno}`);
          console.error(`[BulkUpload]   SQL code     : ${err?.parent?.code}`);
          console.error(`[BulkUpload]   SQL state    : ${err?.parent?.sqlState}`);
          console.error(`[BulkUpload]   Full SQL msg : ${sqlMsg}`);
        }

        if (err?.errors?.length) {
          err.errors.forEach((e: any, i: number) => {
            console.error(`[BulkUpload]   Validation[${i}]: field="${e.path}" value=${JSON.stringify(e.value)} msg="${e.message}"`);
          });
        }

        console.error(`[BulkUpload]   Raw row data:`);
        const sensitiveKeys = new Set(["password"]);
        Object.entries(row as Record<string, any>).forEach(([k, v]) => {
          if (!sensitiveKeys.has(k))
            console.error(`[BulkUpload]     ${k.padEnd(25)} = ${JSON.stringify(v)}  (type: ${typeof v}${v instanceof Date ? " [Date]" : ""})`);
        });

        if (!sqlMsg && err?.name !== "SequelizeValidationError")
          console.error(`[BulkUpload]   Stack: ${err?.stack}`);

        console.error(`[BulkUpload] ─────────────────────────────────────────────\n`);
        rowErrors.push({ row: rowLabel, message: rawMsg });
      }
    }

    console.log(`\n[BulkUpload] ══════════════ UPLOAD COMPLETE ══════════════`);
    console.log(`[BulkUpload]   Total rows processed : ${records.length}`);
    console.log(`[BulkUpload]   ✅ Created            : ${createdCount}`);
    console.log(`[BulkUpload]   ✏️  Updated            : ${updatedCount}`);
    console.log(`[BulkUpload]   ❌ Failed             : ${failedCount}`);
    if (rowErrors.length)
      rowErrors.forEach(e => console.error(`[BulkUpload]     • ${e.row}: ${e.message}`));
    console.log(`[BulkUpload] ═══════════════════════════════════════════════\n`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    for (const entry of emailQueue) {
      sendWelcomeEmail(entry.to, entry.name, entry.username, entry.password).catch(
        (err) => console.error(`[Mailer] Welcome email to ${entry.to} failed:`, err),
      );
    }

    return { created: createdCount, updated: updatedCount, failed: failedCount, errors: rowErrors };
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

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

  // ─── Update ───────────────────────────────────────────────────────────────

  async updateStudent(id: number | string | bigint, body: UpdateStudentInput): Promise<StudentProfile> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");

    // Split body into user-level vs profile-level fields
    const {
      // User-level
      full_name,
      phone_number,
      email,
      address,
      // Profile-level
      status,
      gender,
      preferred_language,
      onboarding_date,
      cost_limit,
      dob,
      analytics_enabled,
      // Ignore anything else not explicitly handled
    } = body;

    // ── Validate phone ────────────────────────────────────────────────────────
    if (phone_number !== undefined && !isValidPhone(phone_number))
      throw new ApiError(400, `phone_number "${phone_number}" must be exactly 10 digits.`);

    // ── Validate gender ───────────────────────────────────────────────────────
    const normalizedGender = gender?.toLowerCase() || null;
    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    const user_id = (student as any).user_id;

    // ── Update User table (full_name, phone_number, email, address) ───────────
    const userUpdates: Record<string, any> = {};
    if (full_name !== undefined) userUpdates.full_name = toNameCase(full_name);
    if (phone_number !== undefined) userUpdates.phone_number = String(phone_number).trim();
    if (email !== undefined) userUpdates.email = email?.trim().toLowerCase() || null;
    if (address !== undefined) userUpdates.address = address || null;

    if (Object.keys(userUpdates).length)
      await studentRepository.updateUser(user_id, userUpdates);

    // ── Update StudentProfile table ───────────────────────────────────────────
    const profileUpdates: Record<string, any> = {};
    if (normalizedGender !== null) profileUpdates.gender = normalizedGender;
    if (preferred_language !== undefined) profileUpdates.preferred_language = preferred_language || null;
    if (onboarding_date !== undefined) profileUpdates.onboarding_date = onboarding_date || null;
    if (cost_limit !== undefined) profileUpdates.cost_limit = cost_limit || null;
    if (dob !== undefined) profileUpdates.dob = dob || null;
    if (analytics_enabled !== undefined) profileUpdates.analytics_enabled = analytics_enabled ?? false;

    if (Object.keys(profileUpdates).length)
      await studentRepository.updateStudentProfile((student as any).student_id, profileUpdates);

    // Re-fetch so response includes fresh user + classSection + parents data
    return studentRepository.findStudentById(id) as Promise<StudentProfile>;
  }

  async deleteStudent(id: number | string | bigint): Promise<void> {
    const student = await studentRepository.findStudentById(id);
    if (!student) throw new ApiError(404, "Student not found");
    const { school_id, user_id } = student as any;
    await studentRepository.deleteStudentWithRelated(id, user_id, school_id);
  }
}

export const studentService = new StudentService();
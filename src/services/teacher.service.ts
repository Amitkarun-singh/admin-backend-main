import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";
import { ApiError } from "../utils/ApiError.js";
import { parseExcel } from "../utils/excel.util.js";
import { teacherRepository } from "../repositories/teacher.repository.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import { generatePassword } from "../utils/password.util.js";
import { generateUsername } from "../utils/username.util.js";
import { sendWelcomeEmail } from "../utils/mailer.util.js";
import curriculumService from "./curriculum.service.js";
import { fetchCurriculumMapsSafe, fetchSubjectMapForClass, enrichTeacherAssignments } from "../utils/curriculumEnrich.js";

// ─── Constants ─────────────────────────────────────────────────────────────────

const VALID_GENDERS              = ["male", "female", "other"];
const GENERAL_STREAM_ID          = 4;
const STREAM_REQUIRED_FROM_GRADE = 11;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalise a person's name to "Name Surname" casing:
 *   - Trim + collapse spaces
 *   - Lowercase everything, then capitalise each word's first letter
 *
 *   "JOHN DOE"    → "John Doe"
 *   "john doe"    → "John Doe"
 *   "john  doe"   → "John Doe"
 */
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

/**
 * Validate & normalise class_name → "Grade <number>"
 * Returns { normalised, gradeNumber }
 */
function validateClassName(raw: string): { normalised: string; gradeNumber: number } {
  const trimmed = raw.trim();
  if (/^(class|std|standard)\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7").`);
  if (/^\d+$/.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7").`);
  if (!/^Grade\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Must match "Grade <number>" (e.g. "Grade 10").`);

  const normalised  = trimmed.replace(/^grade/i, "Grade");
  const gradeNumber = parseInt(normalised.split(/\s+/)[1], 10);
  return { normalised, gradeNumber };
}

/**
 * Resolve stream for a teacher assignment from a user-supplied name (e.g. "Science", "commerce", "ARTS").
 *
 *  - Grade 1–10  → always returns GENERAL_STREAM_ID (4), user input is ignored
 *  - Grade 11+   → user MUST provide a stream name; matched case-insensitively
 *                  against allStreams[].stream_name
 *
 * Error messages:
 *  - Empty/missing for Grade 11+ → "Please provide the stream for this class. Valid options: ..."
 *  - User typed the General stream name → "General is only for classes below Grade 11 ..."
 *  - Name not found → "Stream '<input>' not found. You entered '<input>' — valid streams: ..."
 */
function validateStream(
  rawStreamName: string | null | undefined,
  gradeNumber: number,
  allStreams: any[],
  className: string,
): { id: number; name: string } {
  // Grade 1–10: always General, ignore whatever the user put
  if (gradeNumber < STREAM_REQUIRED_FROM_GRADE) {
    const generalStream = allStreams.find((s: any) => Number(s.id) === GENERAL_STREAM_ID);
    return { id: GENERAL_STREAM_ID, name: generalStream?.stream_name ?? "General" };
  }

  // Build list of valid non-general stream names for error messages
  const validStreams = allStreams.filter((s: any) => Number(s.id) !== GENERAL_STREAM_ID);
  const validNames   = validStreams.map((s: any) => s.stream_name).join(", ");

  // Grade 11+: stream name is mandatory
  if (!rawStreamName || !String(rawStreamName).trim()) {
    throw new Error(
      `stream is required for "${className}". ` +
      `Please provide the stream for this class. Valid options: ${validNames}`
    );
  }

  const normalised = String(rawStreamName).trim().toLowerCase();

  // Reject if user typed the General stream name for Grade 11+
  const generalStream = allStreams.find((s: any) => Number(s.id) === GENERAL_STREAM_ID);
  if (generalStream && normalised === String(generalStream.stream_name).trim().toLowerCase()) {
    throw new Error(
      `"${rawStreamName}" stream is only for classes below Grade ${STREAM_REQUIRED_FROM_GRADE}. ` +
      `Valid options for ${className}: ${validNames}`
    );
  }

  // Match by name (case-insensitive)
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

/**
 * Normalise subject_name to Title Case before curriculum lookup.
 *   "sciences"       → "Sciences"
 *   "MATHEMATICS"    → "Mathematics"
 *   "social studies" → "Social Studies"
 */
function normalizeSubjectName(raw: string): string {
  if (!raw?.trim()) throw new Error("subject_name cannot be empty.");
  return raw.trim().replace(/\s+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Parse a date value from Excel/CSV and return "YYYY-MM-DD".
 */
function parseFlexibleDate(value: any, fieldName: string): string | null {
  console.log(`[DateParser] field="${fieldName}" | type=${typeof value} | value=${JSON.stringify(value)} | isDate=${value instanceof Date}`);

  if (value === undefined || value === null || value === "") {
    console.log(`[DateParser] field="${fieldName}" → null (empty/undefined)`);
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1)
      throw new Error(`Invalid date serial "${value}" in "${fieldName}".`);
    const MS_PER_DAY      = 86400000;
    const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
    const ms  = EXCEL_EPOCH_UTC + value * MS_PER_DAY;
    const d   = new Date(ms);
    if (isNaN(d.getTime()))
      throw new Error(`Cannot decode Excel date serial "${value}" in "${fieldName}".`);
    const y   = d.getUTCFullYear();
    const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;
    console.log(`[DateParser] field="${fieldName}" | serial=${value} → iso="${iso}" ✓`);
    return iso;
  }

  if (value instanceof Date) {
    if (isNaN(value.getTime()))
      throw new Error(`Invalid date in "${fieldName}". The cell contained an unreadable date value.`);
    const y   = value.getFullYear();
    const m   = String(value.getMonth() + 1).padStart(2, "0");
    const d   = String(value.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    console.log(`[DateParser] field="${fieldName}" | JS Date → iso="${iso}" ✓`);
    return iso;
  }

  const str   = String(value).trim();
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
    else          { month = p2; day = p3; }
  } else if (p3 > 31) {
    year = p3;
    if (p1 > 12)      { day = p1; month = p2; }
    else if (p2 > 12) { month = p1; day = p2; }
    else              { month = p1; day = p2; }
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
      allClasses:  classesRes?.data  ?? classesRes  ?? [],
      allSections: sectionsRes?.data ?? sectionsRes ?? [],
      allStreams:  streamsRes?.data  ?? streamsRes  ?? [],
    };
  } catch {
    throw new ApiError(503, "Curriculum service unavailable");
  }
}

// ─── Interfaces ─────────────────────────────────────────────────────────────────

interface CreateTeacherInput {
  school_id: number | bigint;
  phone_number: string;
  full_name: string;
  qualification: string;
  email?: string;
  gender?: string;
  preferred_language?: string;
  class_name?: string;
  subject_name?: string;
  section_name?: string;
  stream?: string | null;       // user supplies name e.g. "Science", "Commerce", "Arts"
  stream_id?: number | null;    // legacy: still accepted for direct API calls
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
}

interface ResolvedAssignment {
  resolvedClassId:   number | null;
  resolvedSubjectId: number | null;
  resolvedSectionId: number | null;
  resolvedStreamId:  number;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class TeacherService {

  /**
   * Resolve class → subject → section from curriculum data.
   * Also resolves stream_id based on grade number.
   */
  private async resolveClassSubjectSection(
    {
      class_name,
      subject_name,
      section_name,
      stream,
      stream_id,
    }: {
      class_name?: string;
      subject_name?: string;
      section_name?: string;
      stream?: string | null;
      stream_id?: number | null;
    },
    school: any,
    allClasses: any[],
    allSections: any[],
    allStreams: any[],
  ): Promise<ResolvedAssignment> {
    let resolvedClassId:   number | null = null;
    let resolvedSubjectId: number | null = null;
    let resolvedSectionId: number | null = null;
    let resolvedStreamId:  number        = GENERAL_STREAM_ID;

    if (!class_name) return { resolvedClassId, resolvedSubjectId, resolvedSectionId, resolvedStreamId };

    const { normalised: normalizedClassName, gradeNumber } = validateClassName(class_name);

    const classRecord = allClasses.find((c: any) => c.class_name === normalizedClassName);
    if (!classRecord) return { resolvedClassId, resolvedSubjectId, resolvedSectionId, resolvedStreamId };
    resolvedClassId = classRecord.id;   // curriculum returns { id, ... }

    // Prefer stream name; fall back to legacy stream_id converted to string so
    // direct API callers passing stream_id still work.
    try {
      const rawStream = stream?.trim() || (stream_id != null ? String(stream_id) : null);
      resolvedStreamId = validateStream(rawStream, gradeNumber, allStreams, normalizedClassName).id;
    } catch (e: any) {
      throw new ApiError(400, e.message);
    }

    if (subject_name) {
      const normalizedSubject = normalizeSubjectName(subject_name);
      // Use resolvedStreamId for subject lookup so Grade 11+ gets the right subjects
      const subjectsRes  = await curriculumService.allSubject(resolvedClassId ?? 0, school.board ?? "", resolvedStreamId);
      const subjectsList: any[] = subjectsRes?.data ?? subjectsRes ?? [];
      const subjectRecord = subjectsList.find((s: any) => s.subject_name === normalizedSubject);
      resolvedSubjectId = subjectRecord ? subjectRecord.id : null;
    }

    if (section_name) {
      // Sections are global — match by name only
      const normalizedSection = section_name.trim().toUpperCase();
      const sectionRecord     = allSections.find((s: any) => s.section_name === normalizedSection);
      resolvedSectionId = sectionRecord ? sectionRecord.id : null;
    }

    return { resolvedClassId, resolvedSubjectId, resolvedSectionId, resolvedStreamId };
  }

  /**
   * Build assignment rows and bulk-insert them.
   * stream_id is now stored on each assignment row.
   */
  private async buildAndInsertAssignments(
    teacherId: number | string,
    {
      primary_subject_id,
      section_id,
      stream_id,
      secondary_subject_ids,
      secondary_section_ids,
      secondary_stream_ids,
    }: {
      primary_subject_id?: number | null;
      section_id?: number | null;
      stream_id?: number;
      secondary_subject_ids?: number[];
      secondary_section_ids?: number[];
      secondary_stream_ids?: number[];
    },
    transaction?: any,
  ): Promise<Record<string, any>[]> {
    const academicYear    = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
    const assignmentRows: Record<string, any>[] = [];

    if (primary_subject_id && section_id) {
      const primarySubject = await teacherRepository.findSubjectById(primary_subject_id, transaction);
      if (primarySubject) {
        assignmentRows.push({
          teacher_id:       Number(teacherId),
          class_id:         (primarySubject as any).class_id,
          section_id:       Number(section_id),
          stream_id:        stream_id ?? GENERAL_STREAM_ID,   // ← stored on assignment
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
        const streamIdForSub  = secondary_stream_ids?.[i]  ? Number(secondary_stream_ids[i])  : GENERAL_STREAM_ID;
        const subjectRecord   = secSubjects.find((s) => Number((s as any).subject_id) === subjectId);
        if (!subjectRecord || !sectionIdForSub) continue;
        assignmentRows.push({
          teacher_id:       Number(teacherId),
          class_id:         (subjectRecord as any).class_id,
          section_id:       sectionIdForSub,
          stream_id:        streamIdForSub,
          class_subject_id: subjectId,
          academic_year:    academicYear,
        });
      }
    }

    await teacherRepository.bulkCreateAssignments(assignmentRows, transaction);
    return assignmentRows;
  }

  // ─── Single Create ───────────────────────────────────────────────────────────

  async createTeacher(input: CreateTeacherInput): Promise<{ teacher: TeacherProfile; secondarySubjects: Array<Record<string, any>> }> {
    const {
      school_id, phone_number, email, full_name, gender, preferred_language,
      class_name, subject_name, section_name, stream, stream_id,
      primary_subject_id, section_id,
      secondary_subject_ids, secondary_section_ids,
      experience, age, onboarding_date, school_tenure,
      device_type, device_access, ppt_generation_enabled, cost_limit, qualification,
    } = input;

    // ── 1. Required field validation ──────────────────────────────────────────
    const missing: string[] = [];
    if (!full_name?.trim())     missing.push("full_name");
    if (!phone_number?.trim())  missing.push("phone_number");
    if (!qualification?.trim()) missing.push("qualification");

    const normalizedSubjectName = subject_name?.trim() ? normalizeSubjectName(subject_name) : undefined;
    const normalizedSectionName = section_name?.trim() ? section_name.trim().toUpperCase()  : undefined;

    const hasIdAssignment   = !!primary_subject_id && !!(section_id ?? normalizedSectionName);
    const hasNameAssignment = !!class_name?.trim() && !!normalizedSubjectName && !!normalizedSectionName;
    if (!hasIdAssignment && !hasNameAssignment)
      missing.push("class_name + subject_name + section_name (or primary_subject_id + section_id)");
    if (missing.length) throw new ApiError(400, `Missing required fields: ${missing.join(", ")}`);

    // ── 2. Phone format validation ────────────────────────────────────────────
    if (!isValidPhone(phone_number))
      throw new ApiError(400, `phone_number "${phone_number}" must be exactly 10 digits.`);

    // ── 3. Gender enum validation ─────────────────────────────────────────────
    const normalizedGender = gender?.toLowerCase() || null;
    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    // ── 4. Normalise name ─────────────────────────────────────────────────────
    const normFullName    = toNameCase(full_name);
    const teacherUsername = generateUsername(normFullName);
    const plainPassword   = "Teacher@123";

    const school = await teacherRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    const transaction = await sequelize.transaction();
    try {
      const role = await teacherRepository.findRoleByName("TEACHER", transaction);
      if (!role) throw new ApiError(400, "Teacher role not found");

      let finalSubjectId: number | null = primary_subject_id || null;
      let finalSectionId: number | null = section_id         || null;
      let finalStreamId:  number        = GENERAL_STREAM_ID;

      if (!finalSubjectId && class_name) {
        const { allClasses, allSections, allStreams } = await fetchCurriculumData();
        const resolved = await this.resolveClassSubjectSection(
          { class_name, subject_name: normalizedSubjectName, section_name: normalizedSectionName, stream, stream_id },
          school,
          allClasses,
          allSections,
          allStreams,
        );
        finalSubjectId = resolved.resolvedSubjectId;
        finalSectionId = resolved.resolvedSectionId;
        finalStreamId  = resolved.resolvedStreamId;
      }

      const hashed = await bcrypt.hash(plainPassword, 10);

      const user = await teacherRepository.createUser({
        username:                   teacherUsername,
        full_name:                  normFullName,         // ← "Name Surname" casing
        password:                   hashed,
        phone_number,
        email:                      email || null,
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
        gender:                 normalizedGender,
        preferred_language:     preferred_language     || null,
      }, transaction);

      await this.buildAndInsertAssignments(
        (teacher as any).teacher_id,
        {
          primary_subject_id:    finalSubjectId,
          section_id:            finalSectionId,
          stream_id:             finalStreamId,
          secondary_subject_ids: secondary_subject_ids || [],
          secondary_section_ids: secondary_section_ids || [],
        },
        transaction,
      );

      await teacherRepository.incrementSchoolTeacherCount(school_id, 1, transaction);
      await transaction.commit();

      if (email) {
        sendWelcomeEmail(email, normFullName, teacherUsername, plainPassword)
          .catch((e) => console.error("[Mailer] Teacher welcome email failed:", e));
      }

      const created           = await teacherRepository.findTeacherById((teacher as any).teacher_id);
      const secondarySubjects = await teacherRepository.findSecondarySubjects((created as any).secondary_subject_ids);

      return { teacher: created!, secondarySubjects };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // ─── Bulk Upload ─────────────────────────────────────────────────────────────

  async bulkTeacherUpload(
    filePath: string,
    school_id: number | bigint,
  ): Promise<{ created: number; updated: number; failed: number; errors: Array<{ row: string; message: string }> }> {

    const school = await teacherRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(400, "School not found");

    const records = parseExcel(filePath);
    if (!records.length) throw new ApiError(400, "Excel file is empty");

    const role = await teacherRepository.findRoleByName("TEACHER");
    if (!role) throw new ApiError(400, "Teacher role not found");

    // ── Fetch curriculum data once before the loop ────────────────────────────
    const { allClasses, allSections, allStreams } = await fetchCurriculumData();

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount  = 0;
    const rowErrors: Array<{ row: string; message: string }> = [];
    const emailQueue: Array<{ to: string; name: string; username: string; password: string }> = [];

    for (const [index, row] of (records as any[]).entries()) {
      const rowLabel = `Row ${index + 2}`;
      const tx = await sequelize.transaction();

      try {
        // ── 1. Mandatory fields ──────────────────────────────────────────────
        const rowMissing: string[] = [];
        if (!row.full_name)     rowMissing.push("full_name");
        if (!row.phone_number)  rowMissing.push("phone_number");
        if (!row.qualification) rowMissing.push("qualification");
        if (!row.class_name)    rowMissing.push("class_name");
        if (!row.subject_name)  rowMissing.push("subject_name");
        if (!row.section_name)  rowMissing.push("section_name");
        if (rowMissing.length)  throw new Error(`Missing required fields: ${rowMissing.join(", ")}`);

        // ── 2. Normalise name to "Name Surname" ──────────────────────────────
        const teacherFullName = toNameCase(String(row.full_name));

        // ── 3. Phone validation ───────────────────────────────────────────────
        if (!isValidPhone(row.phone_number))
          throw new Error(`phone_number "${row.phone_number}" must be exactly 10 digits.`);
        const teacherPhone = String(row.phone_number).trim();

        // ── 4. class_name validation ──────────────────────────────────────────
        const { normalised: normalizedClassName, gradeNumber } = validateClassName(String(row.class_name));

        // ── 5. section_name → UPPERCASE ───────────────────────────────────────
        const normalizedSectionName = String(row.section_name).trim().toUpperCase();

        // ── 6. subject_name → Title Case ─────────────────────────────────────
        const normalizedSubjectName = normalizeSubjectName(String(row.subject_name));

        // ── 7. stream — resolve by name (e.g. "Science", "Commerce", "Arts") ──
        // Excel column: "stream" (name string) or legacy "stream_id" (number)
        // Grade 1–10  → ignored, always defaults to General
        // Grade 11+   → mandatory; matched case-insensitively against curriculum data
        let resolvedStreamId: number;
        try {
          const rawStream = row.stream ?? (row.stream_id != null ? String(row.stream_id) : null);
          resolvedStreamId = validateStream(
            rawStream,
            gradeNumber,
            allStreams,
            normalizedClassName,
          ).id;
        } catch (e: any) {
          throw new Error(e.message);
        }

        // ── 8. Resolve class ──────────────────────────────────────────────────
        const classRecord = allClasses.find((c: any) => c.class_name === normalizedClassName);
        if (!classRecord)
          throw new Error(`Class "${normalizedClassName}" does not exist. Please create it first.`);
        const resolvedClassId: number = classRecord.id;

        // ── 9. Resolve section — sections are global, match by name only ──────
        const sectionRecord = allSections.find((s: any) => s.section_name === normalizedSectionName);
        if (!sectionRecord)
          throw new Error(`Section "${normalizedSectionName}" does not exist. Please create it first.`);
        const resolvedSectionId: number = sectionRecord.id;

        // ── 10. Resolve subject — use resolvedStreamId for correct subject list ─
        const subjectsRes   = await curriculumService.allSubject(resolvedClassId, (school as any).board ?? "", resolvedStreamId);
        const subjectsList: any[] = subjectsRes?.data ?? subjectsRes ?? [];
        const subjectRecord = subjectsList.find((s: any) => s.subject_name === normalizedSubjectName);
        if (!subjectRecord)
          throw new Error(`Subject "${normalizedSubjectName}" not found in class "${normalizedClassName}". Please create it first.`);
        const resolvedSubjectId: number = subjectRecord.id;

        // ── 11. Flexible date parsing ─────────────────────────────────────────
        const validatedDob            = parseFlexibleDate(row.dob,             "dob");
        const validatedOnboardingDate = parseFlexibleDate(row.onboarding_date, "onboarding_date");

        // ── 12. Gender enum validation ────────────────────────────────────────
        const normalizedGender = row.gender ? String(row.gender).toLowerCase() : null;
        if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
          throw new Error(`Invalid gender "${row.gender}". Must be one of: ${VALID_GENDERS.join(", ")}`);

        // ── 13. Email normalisation ───────────────────────────────────────────
        const emailRaw = row.email ? String(row.email).trim().toLowerCase() : null;

        // ── 14. Teacher upsert ────────────────────────────────────────────────
        //
        //  Unique key: full_name (Name Surname) + phone_number + role_id
        //
        //  Same reasoning as student service — phone alone is not reliable
        //  (two teachers could share a school phone), name+phone+role is the
        //  safest combination without a separate unique DB constraint.
        //
        let teacherProfile: TeacherProfile;
        let isNewTeacher    = false;
        let plainPassword   = "";
        let teacherUsername = "";

        const existingUser = await teacherRepository.findUserByNamePhoneAndRole(
          teacherFullName,
          teacherPhone,
          (role as any).role_id,
          tx,
        );

        if (existingUser) {
          // ── Existing teacher: diff & update ─────────────────────────────
          const existingProfile = await teacherRepository.findTeacherProfileByUserId(
            (existingUser as any).user_id, tx,
          );
          if (!existingProfile)
            throw new Error(
              `User "${teacherFullName}" (${teacherPhone}) exists but has no TeacherProfile. ` +
              `Please check their account manually.`,
            );

          const userUpdates: Record<string, any> = {};
          if (emailRaw !== undefined && emailRaw !== (existingUser as any).email)
            userUpdates.email = emailRaw;

          const profileUpdates: Record<string, any> = {};
          if (normalizedGender && normalizedGender !== (existingProfile as any).gender)
            profileUpdates.gender = normalizedGender;
          if (validatedDob && validatedDob !== (existingProfile as any).dob?.toISOString?.().slice(0, 10))
            profileUpdates.dob = validatedDob;
          if (validatedOnboardingDate && validatedOnboardingDate !== (existingProfile as any).onboarding_date?.toISOString?.().slice(0, 10))
            profileUpdates.onboarding_date = validatedOnboardingDate;
          if (row.qualification !== undefined && row.qualification !== (existingProfile as any).qualification)
            profileUpdates.qualification = row.qualification || null;
          if (row.experience !== undefined && String(row.experience || "") !== String((existingProfile as any).experience ?? ""))
            profileUpdates.experience = row.experience || null;
          if (row.age !== undefined && String(row.age || "") !== String((existingProfile as any).age ?? ""))
            profileUpdates.age = row.age || null;
          if (row.school_tenure !== undefined && String(row.school_tenure || "") !== String((existingProfile as any).school_tenure ?? ""))
            profileUpdates.school_tenure = row.school_tenure || null;
          if (row.cost_limit !== undefined && String(row.cost_limit || "") !== String((existingProfile as any).cost_limit ?? ""))
            profileUpdates.cost_limit = row.cost_limit || null;
          if (row.preferred_language !== undefined && row.preferred_language !== (existingProfile as any).preferred_language)
            profileUpdates.preferred_language = row.preferred_language || null;
          if (row.device_type !== undefined && row.device_type !== (existingProfile as any).device_type)
            profileUpdates.device_type = row.device_type || null;
          if (row.ppt_generation_enabled !== undefined && row.ppt_generation_enabled !== (existingProfile as any).ppt_generation_enabled)
            profileUpdates.ppt_generation_enabled = row.ppt_generation_enabled ?? false;

          if (Object.keys(userUpdates).length)
            await teacherRepository.updateUser((existingUser as any).user_id, userUpdates, tx);
          if (Object.keys(profileUpdates).length)
            await teacherRepository.updateTeacherProfile((existingProfile as any).teacher_id, profileUpdates, tx);

          // Assignment upsert — replace if subject/section/stream changed
          const existingAssignment = await teacherRepository.findAssignmentByTeacher(
            (existingProfile as any).teacher_id, tx,
          );
          const assignmentChanged =
            !existingAssignment ||
            (existingAssignment as any).class_subject_id !== resolvedSubjectId ||
            (existingAssignment as any).section_id       !== resolvedSectionId ||
            (existingAssignment as any).stream_id        !== resolvedStreamId;

          if (assignmentChanged) {
            await teacherRepository.deleteAssignmentsByTeacher((existingProfile as any).teacher_id, tx);
            await this.buildAndInsertAssignments(
              (existingProfile as any).teacher_id,
              {
                primary_subject_id: resolvedSubjectId,
                section_id:         resolvedSectionId,
                stream_id:          resolvedStreamId,
                secondary_subject_ids: [],
                secondary_section_ids: [],
              },
              tx,
            );
          }

          teacherProfile = existingProfile;

        } else {
          // ── New teacher: create ──────────────────────────────────────────
          isNewTeacher    = true;
          plainPassword   = generatePassword();
          teacherUsername = generateUsername(teacherFullName);
          const hashed    = await bcrypt.hash(plainPassword, 10);

          const user = await teacherRepository.createUser({
            username:                   teacherUsername,
            full_name:                  teacherFullName,    // ← "Name Surname" casing
            password:                   hashed,
            phone_number:               teacherPhone,
            email:                      emailRaw || null,
            role_id:                    (role as any).role_id,
            school_id,
            status:                     "Active",
            is_password_reset_required: true,
          }, tx);

          teacherProfile = await teacherRepository.createTeacherProfile({
            user_id:                user.user_id,
            school_id,
            primary_subject_id:     resolvedSubjectId,
            secondary_subject_ids:  null,
            experience:             row.experience            || null,
            age:                    row.age                   || null,
            onboarding_date:        validatedOnboardingDate,
            school_tenure:          row.school_tenure         || null,
            device_type:            row.device_type           || null,
            device_access:          row.device_access         || null,
            ppt_generation_enabled: row.ppt_generation_enabled ?? false,
            cost_limit:             row.cost_limit            || null,
            qualification:          row.qualification,
            gender:                 normalizedGender,
            preferred_language:     row.preferred_language    || null,
            dob:                    validatedDob,
          }, tx);

          await this.buildAndInsertAssignments(
            (teacherProfile as any).teacher_id,
            {
              primary_subject_id:    resolvedSubjectId,
              section_id:            resolvedSectionId,
              stream_id:             resolvedStreamId,
              secondary_subject_ids: [],
              secondary_section_ids: [],
            },
            tx,
          );

          await teacherRepository.incrementSchoolTeacherCount(school_id, 1, tx);
        }

        await tx.commit();

        if (isNewTeacher) {
          createdCount++;
        } else {
          updatedCount++;
        }

        if (isNewTeacher && emailRaw)
          emailQueue.push({ to: emailRaw, name: teacherFullName, username: teacherUsername, password: plainPassword });

      } catch (err: any) {
        await tx.rollback();
        failedCount++;

        const sqlMsg  = err?.parent?.sqlMessage;
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
    console.log(`[BulkUpload]   🔄 Updated            : ${updatedCount}`);
    console.log(`[BulkUpload]   ❌ Failed             : ${failedCount}`);
    if (rowErrors.length)
      rowErrors.forEach(e => console.error(`[BulkUpload]     • ${e.row}: ${e.message}`));
    console.log(`[BulkUpload] ═══════════════════════════════════════════════\n`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    for (const entry of emailQueue) {
      sendWelcomeEmail(entry.to, entry.name, entry.username, entry.password)
        .catch((err) => console.error(`[Mailer] Welcome email to ${entry.to} failed:`, err));
    }

    return { created: createdCount, updated: updatedCount, failed: failedCount, errors: rowErrors };
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────────

  private async enrichTeacher(teacher: any): Promise<any> {
    const json = typeof teacher.toJSON === "function" ? teacher.toJSON() : { ...teacher };
    const maps = await fetchCurriculumMapsSafe();
    const assignments = enrichTeacherAssignments(json.assignments ?? [], maps);

    const enrichedAssignments = await Promise.all(
      assignments.map(async (a: any) => {
        if (!a.class_id || !a.class_subject_id) return a;
        const subjectMap = await fetchSubjectMapForClass(a.class_id);
        return { ...a, subject_name: subjectMap.get(Number(a.class_subject_id)) ?? null };
      })
    );

    const secondarySubjects = await teacherRepository.findSecondarySubjects(json.secondary_subject_ids);
    return { ...json, assignments: enrichedAssignments, secondarySubjects };
  }

  async getAllTeachers(school_id: number | bigint): Promise<Array<TeacherProfile & { secondarySubjects: Array<Record<string, any>> }>> {
    const teachers = await teacherRepository.findAllTeachers(school_id);
    return Promise.all(teachers.map((t) => this.enrichTeacher(t))) as any;
  }

  async getTeacherById(id: number | string | bigint): Promise<TeacherProfile & { secondarySubjects: Array<Record<string, any>> }> {
    const teacher = await teacherRepository.findTeacherById(id);
    if (!teacher) throw new ApiError(404, "Teacher not found");
    return this.enrichTeacher(teacher) as any;
  }

  async updateTeacher(
    id: number | string | bigint,
    body: Record<string, any>,
  ): Promise<TeacherProfile & { secondarySubjects: Array<Record<string, any>> }> {
    const teacher = await teacherRepository.findTeacherRaw(id);
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const school = await teacherRepository.findSchoolById((teacher as any).school_id);

    if (body.gender) {
      const normalizedGender = String(body.gender).toLowerCase();
      if (!VALID_GENDERS.includes(normalizedGender))
        throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);
      body = { ...body, gender: normalizedGender };
    }

    if (body.phone_number && !isValidPhone(body.phone_number))
      throw new ApiError(400, `phone_number "${body.phone_number}" must be exactly 10 digits.`);

    const {
      user_id, school_id,
      class_name, subject_name, section_name, stream, stream_id,
      primary_subject_id, section_id,
      secondary_subject_ids, secondary_section_ids, secondary_stream_ids,
      ...profileUpdates
    } = body;

    const transaction = await sequelize.transaction();
    try {
      let finalSubjectId: number | undefined = primary_subject_id;
      let finalSectionId: number | undefined = section_id;
      let finalStreamId:  number             = GENERAL_STREAM_ID;

      if (class_name) {
        const { allClasses, allSections, allStreams } = await fetchCurriculumData();
        const resolved = await this.resolveClassSubjectSection(
          { class_name, subject_name, section_name, stream, stream_id },
          school,
          allClasses,
          allSections,
          allStreams,
        );
        finalSubjectId = resolved.resolvedSubjectId ?? undefined;
        finalSectionId = resolved.resolvedSectionId ?? undefined;
        finalStreamId  = resolved.resolvedStreamId;
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
            stream_id:             finalStreamId,
            secondary_subject_ids: secondary_subject_ids ?? (teacher as any).secondary_subject_ids,
            secondary_section_ids,
            secondary_stream_ids,
          },
          transaction,
        );
      }

      await transaction.commit();

      const updated = await teacherRepository.findTeacherById(id);
      return this.enrichTeacher(updated) as any;
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
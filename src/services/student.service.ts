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

const VALID_RELATIONS = ["father", "mother", "guardian"];
const VALID_GENDERS   = ["male", "female", "other"];

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface CreateStudentInput {
  student_full_name: string;
  student_phone: string;
  class_id: number;
  section_id: number;
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
  gender?: string;
  status?: string;
  [key: string]: any;
}

// ─── Validation Helpers ────────────────────────────────────────────────────────

/** Capitalise the first letter of every word */
function toTitleCase(str: string): string {
  return str.trim().replace(/\s+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Must be exactly 10 numeric digits */
function isValidPhone(phone: string | number): boolean {
  return /^\d{10}$/.test(String(phone).trim());
}

/**
 * Validate & normalise class_name.
 * Accepted : "Grade 7", "grade 10"  →  normalised to "Grade 7"
 * Rejected : "Class 7", "Std 7", "7", "10A", etc.
 */
function validateClassName(raw: string): string {
  const trimmed = raw.trim();
  if (/^(class|std|standard)\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7"). "Class X" / "Std X" are not accepted.`);
  if (/^\d+$/.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Use "Grade <number>" (e.g. "Grade 7").`);
  if (!/^Grade\s+\d+$/i.test(trimmed))
    throw new Error(`Invalid class_name "${trimmed}". Must match "Grade <number>" exactly (e.g. "Grade 10").`);
  return trimmed.replace(/^grade/i, "Grade");
}

/**
 * Parse a date value from Excel/CSV and return "YYYY-MM-DD".
 *
 * Handles all of these inputs:
 *
 *   Excel serial number  →  e.g. 41906  (days since Excel epoch 1899-12-30)
 *   JS Date object       →  from xlsx parsers that already decoded the cell
 *   String formats       →  any of:
 *       DD-MM-YYYY  /  DD/MM/YYYY  /  DD.MM.YYYY   e.g. 15-03-2012
 *       MM-DD-YYYY  /  MM/DD/YYYY                  e.g. 03-15-2012
 *       YYYY-MM-DD  /  YYYY/MM/DD                  e.g. 2012-03-15  (ISO preferred)
 *       YYYY-DD-MM                                 e.g. 2012-15-03
 *       M/D/YYYY or D/M/YYYY                       e.g. 9/24/2014
 *
 * Ambiguity rule when both non-year parts ≤ 12:
 *   Year last  → treat as DD-MM-YYYY  (day first, most common non-ISO)
 *   Year first → treat as YYYY-MM-DD  (ISO, month before day)
 */
function parseFlexibleDate(value: any, fieldName: string): string | null {
  // ── Debug: log every raw value entering the parser ──────────────────────────
  console.log(`[DateParser] field="${fieldName}" | type=${typeof value} | value=${JSON.stringify(value)} | isDate=${value instanceof Date}`);

  if (value === undefined || value === null || value === "") {
    console.log(`[DateParser] field="${fieldName}" → null (empty/undefined)`);
    return null;
  }

  // ── Excel serial number (number cell not auto-decoded as Date) ──────────────
  if (typeof value === "number") {
    console.log(`[DateParser] field="${fieldName}" | path=EXCEL_SERIAL | serial=${value}`);

    if (!Number.isFinite(value) || value < 1) {
      console.error(`[DateParser] field="${fieldName}" | INVALID serial=${value} (not finite or < 1)`);
      throw new Error(`Invalid date serial "${value}" in "${fieldName}".`);
    }

    const MS_PER_DAY      = 86400000;
    const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30); // Dec 30, 1899 00:00 UTC
    const ms  = EXCEL_EPOCH_UTC + value * MS_PER_DAY;
    const d   = new Date(ms);

    console.log(`[DateParser] field="${fieldName}" | serial=${value} | ms=${ms} | decoded=${d.toISOString()}`);

    if (isNaN(d.getTime())) {
      console.error(`[DateParser] field="${fieldName}" | INVALID decoded Date from serial=${value}`);
      throw new Error(`Cannot decode Excel date serial "${value}" in "${fieldName}".`);
    }

    const y   = d.getUTCFullYear();
    const m   = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const iso = `${y}-${m}-${day}`;

    console.log(`[DateParser] field="${fieldName}" | serial=${value} → iso="${iso}" ✓`);
    return iso;
  }

  // ── JS Date object (xlsx parser already decoded the cell) ──────────────────
  if (value instanceof Date) {
    console.log(`[DateParser] field="${fieldName}" | path=JS_DATE | raw=${value.toISOString?.() ?? value}`);

    if (isNaN(value.getTime())) {
      console.error(`[DateParser] field="${fieldName}" | INVALID JS Date object — getTime()=NaN`);
      console.error(`[DateParser]   This usually means the Excel cell contained text that looked`);
      console.error(`[DateParser]   like a date but couldn't be parsed (e.g. "N/A", "—", a formula error).`);
      throw new Error(`Invalid date in "${fieldName}". The cell contained an unreadable date value.`);
    }

    const y   = value.getFullYear();
    const m   = String(value.getMonth() + 1).padStart(2, "0");
    const d   = String(value.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;

    console.log(`[DateParser] field="${fieldName}" | JS Date → iso="${iso}" ✓`);
    return iso;
  }

  // ── String date ─────────────────────────────────────────────────────────────
  const str = String(value).trim();
  console.log(`[DateParser] field="${fieldName}" | path=STRING | str="${str}"`);

  // Match 1–4 digit parts separated by - / or .
  // Covers: 9/24/2014  15-03-2012  2012.03.15  etc.
  const match = str.match(/^(\d{1,4})([-\/\.])(\d{1,2})\2(\d{1,4})$/);
  if (!match) {
    console.error(`[DateParser] field="${fieldName}" | NO REGEX MATCH for str="${str}"`);
    console.error(`[DateParser]   Raw value type was: ${typeof value}`);
    console.error(`[DateParser]   Possible causes:`);
    console.error(`[DateParser]     • Extra spaces or non-breaking spaces in the cell`);
    console.error(`[DateParser]     • Text like "N/A", "-", "—", or a formula error (#VALUE!, #REF!)`);
    console.error(`[DateParser]     • Mixed separators e.g. "15-03/2012"`);
    console.error(`[DateParser]     • Trailing characters e.g. "2012-03-15T00:00:00"`);
    throw new Error(
      `Invalid date "${str}" in "${fieldName}". ` +
      `Accepted formats: DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD, YYYY-DD-MM ` +
      `(separators: - / .)  e.g. 15-03-2012 or 9/24/2014`
    );
  }

  const p1 = parseInt(match[1], 10);
  const p2 = parseInt(match[3], 10);
  const p3 = parseInt(match[4], 10);
  console.log(`[DateParser] field="${fieldName}" | str="${str}" | parts: p1=${p1} sep="${match[2]}" p2=${p2} p3=${p3}`);

  let year: number, month: number, day: number;
  let detectedFormat: string;

  if (p1 > 31) {
    year = p1;
    if (p2 > 12) {
      detectedFormat = "YYYY-DD-MM";
      day = p2; month = p3;
    } else {
      detectedFormat = "YYYY-MM-DD (ISO)";
      month = p2; day = p3;
    }
  } else if (p3 > 31) {
    year = p3;
    if (p1 > 12) {
      detectedFormat = "DD-MM-YYYY";
      day = p1; month = p2;
    } else if (p2 > 12) {
      detectedFormat = "MM-DD-YYYY (day>12, unambiguous)";
      month = p1; day = p2;
    } else {
      detectedFormat = "MM-DD-YYYY (ambiguous, defaulting to month-first/US)";
      month = p1; day = p2;
    }
  } else {
    console.error(`[DateParser] field="${fieldName}" | CANNOT DETERMINE YEAR in "${str}"`);
    console.error(`[DateParser]   p1=${p1} p2=${p2} p3=${p3} — none of the parts is > 31 (a 4-digit year)`);
    console.error(`[DateParser]   Ensure the year is 4 digits.`);
    throw new Error(
      `Cannot determine year in date "${str}" for "${fieldName}". Please use a 4-digit year.`
    );
  }

  console.log(`[DateParser] field="${fieldName}" | str="${str}" | detected format="${detectedFormat}" | year=${year} month=${month} day=${day}`);

  if (month < 1 || month > 12) {
    console.error(`[DateParser] field="${fieldName}" | INVALID month=${month} (must be 1–12) from str="${str}"`);
    throw new Error(`Invalid month ${month} parsed from date "${str}" in "${fieldName}".`);
  }
  if (day < 1 || day > 31) {
    console.error(`[DateParser] field="${fieldName}" | INVALID day=${day} (must be 1–31) from str="${str}"`);
    throw new Error(`Invalid day ${day} parsed from date "${str}" in "${fieldName}".`);
  }

  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (isNaN(Date.parse(iso))) {
    console.error(`[DateParser] field="${fieldName}" | ISO "${iso}" is not a real calendar date (from str="${str}")`);
    console.error(`[DateParser]   year=${year} month=${month} day=${day}`);
    throw new Error(`Date "${str}" in "${fieldName}" resolves to an invalid calendar date (${iso}).`);
  }

  console.log(`[DateParser] field="${fieldName}" | str="${str}" → iso="${iso}" ✓`);
  return iso;
}

// ─── Service ───────────────────────────────────────────────────────────────────

export class StudentService {

  // ─── Single create ───────────────────────────────────────────────────────────
  async createStudent(input: CreateStudentInput): Promise<StudentProfile> {
    const {
      student_full_name, student_phone, student_email, student_address,
      class_id, section_id, roll_number, academic_year,
      gender, preferred_language, onboarding_date, cost_limit, dob, analytics_enabled,
      parent_full_name, parent_phone, parent_email, parent_address,
      relation, school_id,
    } = input;

    const missing: string[] = [];
    if (!student_full_name) missing.push("student_full_name");
    if (!student_phone)     missing.push("student_phone");
    if (!class_id)          missing.push("class_id");
    if (!section_id)        missing.push("section_id");
    if (!parent_full_name)  missing.push("parent_full_name");
    if (!parent_phone)      missing.push("parent_phone");
    if (missing.length) throw new ApiError(400, `Missing required fields: ${missing.join(", ")}`);

    const school = await studentRepository.findSchoolById(school_id);
    if (!school) throw new ApiError(404, "School not found");

    const normalizedRelation = relation?.toLowerCase() || null;
    const normalizedGender   = gender?.toLowerCase()   || null;
    if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
      throw new ApiError(400, `Invalid relation. Must be one of: ${VALID_RELATIONS.join(", ")}`);
    if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
      throw new ApiError(400, `Invalid gender. Must be one of: ${VALID_GENDERS.join(", ")}`);

    const plainStudentPassword = "Student@123";
    const plainParentPassword  = "Parent@123";
    const studentUsername      = generateUsername(student_full_name);
    const parentUsername       = generateUsername(parent_full_name);

    const transaction = await sequelize.transaction();
    try {
      const [studentRole, parentRole] = await Promise.all([
        studentRepository.findRoleByName("STUDENT", transaction),
        studentRepository.findRoleByName("PARENT",  transaction),
      ]);
      if (!studentRole || !parentRole) throw new ApiError(400, "Student or Parent role missing");

      const resolvedParentPhone   = parent_phone   || student_phone;
      const resolvedParentAddress = parent_address || student_address || null;

      const parentHashed = await bcrypt.hash(plainParentPassword, 10);
      const parentUser   = await studentRepository.createUser({
        username: parentUsername, full_name: parent_full_name,
        password: parentHashed,  phone_number: resolvedParentPhone,
        email: parent_email || null, address: resolvedParentAddress,
        role_id: parentRole.role_id, school_id, status: "Active",
        is_password_reset_required: true,
      }, transaction);

      const parent = await studentRepository.createParentProfile({
        user_id: parentUser.user_id, school_id, relation: normalizedRelation,
      }, transaction);

      const studentHashed = await bcrypt.hash(plainStudentPassword, 10);
      const studentUser   = await studentRepository.createUser({
        username: studentUsername, full_name: student_full_name,
        password: studentHashed,  phone_number: student_phone,
        email: student_email || null, address: student_address || null,
        role_id: studentRole.role_id, school_id, status: "Active",
        is_password_reset_required: true,
      }, transaction);

      const student = await studentRepository.createStudentProfile({
        user_id: studentUser.user_id, school_id,
        preferred_language: preferred_language || null,
        onboarding_date: onboarding_date || null,
        cost_limit: cost_limit || null,
        dob: dob || null, gender: normalizedGender,
        analytics_enabled: analytics_enabled ?? false,
      }, transaction);

      await studentRepository.createParentStudentMap(
        { parent_id: BigInt((parent as any).parent_id), student_id: BigInt(student.student_id) }, transaction
      );
      await studentRepository.createClassSection({
        student_id: student.student_id, class_id, section_id,
        roll_number: roll_number || null, academic_year: academic_year || null, status: "active",
      }, transaction);
      await studentRepository.incrementSchoolStudentCount(school_id, 1, transaction);
      await transaction.commit();

      if (student_email) sendWelcomeEmail(student_email, student_full_name, studentUsername, plainStudentPassword)
        .catch((e) => console.error("[Mailer] Student welcome email failed:", e));
      if (parent_email)  sendWelcomeEmail(parent_email, parent_full_name, parentUsername, plainParentPassword)
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
        if (!row.student_full_name) rowMissing.push("student_full_name");
        if (!row.student_phone)     rowMissing.push("student_phone");
        if (!row.parent_full_name)  rowMissing.push("parent_full_name");
        if (!row.parent_phone)      rowMissing.push("parent_phone");
        if (!row.class_name)        rowMissing.push("class_name");
        if (!row.section_name)      rowMissing.push("section_name");
        if (rowMissing.length) throw new Error(`Missing required fields: ${rowMissing.join(", ")}`);

        // ── 2. Name normalisation ────────────────────────────────────────────
        const studentFullName = toTitleCase(String(row.student_full_name));
        const parentFullName  = toTitleCase(String(row.parent_full_name));

        // ── 3. Phone validation ──────────────────────────────────────────────
        if (!isValidPhone(row.student_phone))
          throw new Error(`student_phone "${row.student_phone}" must be exactly 10 digits.`);
        if (row.parent_phone && !isValidPhone(row.parent_phone))
          throw new Error(`parent_phone "${row.parent_phone}" must be exactly 10 digits.`);

        const studentPhone = String(row.student_phone).trim();
        const parentPhone  = String(row.parent_phone || row.student_phone).trim();

        // ── 4. class_name validation ─────────────────────────────────────────
        const normalizedClassName = validateClassName(String(row.class_name));

        // ── 5. section_name → UPPERCASE ──────────────────────────────────────
        const normalizedSectionName = String(row.section_name).trim().toUpperCase();

        // ── 6. Flexible date parsing (all four formats accepted) ─────────────
        const validatedDob            = parseFlexibleDate(row.dob,             "dob");
        const validatedOnboardingDate = parseFlexibleDate(row.onboarding_date, "onboarding_date");

        // ── 7. Enum validation ────────────────────────────────────────────────
        const normalizedRelation = row.relation ? String(row.relation).toLowerCase() : null;
        const normalizedGender   = row.gender   ? String(row.gender).toLowerCase()   : null;
        if (normalizedRelation && !VALID_RELATIONS.includes(normalizedRelation))
          throw new Error(`Invalid relation "${row.relation}". Must be one of: ${VALID_RELATIONS.join(", ")}`);
        if (normalizedGender && !VALID_GENDERS.includes(normalizedGender))
          throw new Error(`Invalid gender "${row.gender}". Must be one of: ${VALID_GENDERS.join(", ")}`);

        // ── 8. Email normalisation ────────────────────────────────────────────
        const studentEmailRaw = row.student_email ? String(row.student_email).trim().toLowerCase() : null;
        const parentEmailRaw  = row.parent_email  ? String(row.parent_email).trim().toLowerCase()  : null;

        // ── 9. Resolve class & section ────────────────────────────────────────
        const classRecord = await studentRepository.findClassByName(normalizedClassName, tx);
        if (!classRecord)
          throw new Error(`Class "${normalizedClassName}" does not exist. Please create it first.`);
        const resolvedClassId: number = (classRecord as any).class_id;

        const sectionRecord = await studentRepository.findSectionByName(resolvedClassId, normalizedSectionName, tx);
        if (!sectionRecord)
          throw new Error(`Section "${normalizedSectionName}" not found in class "${normalizedClassName}". Please create it first.`);
        const resolvedSectionId: number = (sectionRecord as any).section_id;

        // ── 10. Student — upsert logic ────────────────────────────────────────
        //
        //  EXISTS  → update User + StudentProfile fields that have changed
        //  NEW     → create User + StudentProfile
        //
        let student: StudentProfile;
        let isNewStudent = false;
        let plainStudentPassword = "";
        let studentUsername      = "";
        let studentRowUpdated    = false;

        const existingStudentUser = await studentRepository.findUserByNameAndPhone(studentFullName, studentPhone, tx);

        if (existingStudentUser) {
          // ── Existing student: update changed fields ──────────────────────
          const existingStudent = await studentRepository.findStudentProfileByUserId(
            (existingStudentUser as any).user_id, tx
          );
          if (!existingStudent)
            throw new Error(
              `User "${studentFullName}" (${studentPhone}) exists but has no StudentProfile. ` +
              `Please check their account manually.`
            );

          // Build User-level diff — only update fields that are provided and different
          const userUpdates: Record<string, any> = {};
          if (studentEmailRaw  !== undefined && studentEmailRaw  !== (existingStudentUser as any).email)
            userUpdates.email   = studentEmailRaw;
          if (row.student_address !== undefined && row.student_address !== (existingStudentUser as any).address)
            userUpdates.address = row.student_address || null;

          // Build StudentProfile-level diff
          const profileUpdates: Record<string, any> = {};
          if (normalizedGender        && normalizedGender        !== (existingStudent as any).gender)
            profileUpdates.gender             = normalizedGender;
          if (validatedDob            && validatedDob            !== (existingStudent as any).dob?.toISOString?.().slice(0,10))
            profileUpdates.dob                = validatedDob;
          if (validatedOnboardingDate && validatedOnboardingDate !== (existingStudent as any).onboarding_date?.toISOString?.().slice(0,10))
            profileUpdates.onboarding_date    = validatedOnboardingDate;
          if (row.preferred_language  !== undefined && row.preferred_language  !== (existingStudent as any).preferred_language)
            profileUpdates.preferred_language = row.preferred_language || null;
          if (row.cost_limit          !== undefined && row.cost_limit          !== (existingStudent as any).cost_limit)
            profileUpdates.cost_limit         = row.cost_limit || null;
          if (row.analytics_enabled   !== undefined && row.analytics_enabled   !== (existingStudent as any).analytics_enabled)
            profileUpdates.analytics_enabled  = row.analytics_enabled ?? false;

          if (Object.keys(userUpdates).length)
            await studentRepository.updateUser((existingStudentUser as any).user_id, userUpdates, tx);
          if (Object.keys(profileUpdates).length)
            await studentRepository.updateStudentProfile((existingStudent as any).student_id, profileUpdates, tx);

          if (Object.keys(userUpdates).length || Object.keys(profileUpdates).length)
            studentRowUpdated = true;

          student = existingStudent;
        } else {
          // ── New student: create ──────────────────────────────────────────
          isNewStudent         = true;
          plainStudentPassword = generatePassword();
          studentUsername      = generateUsername(studentFullName);

          const studentHashed = await bcrypt.hash(plainStudentPassword, 10);
          const studentUser   = await studentRepository.createUser({
            username:     studentUsername,
            full_name:    studentFullName,
            password:     studentHashed,
            phone_number: studentPhone,
            email:        studentEmailRaw || null,
            address:      row.student_address || null,
            role_id:      studentRole.role_id,
            school_id,    status: "Active",
            is_password_reset_required: true,
          }, tx);

          student = await studentRepository.createStudentProfile({
            user_id:            studentUser.user_id,
            school_id,
            preferred_language: row.preferred_language   || null,
            onboarding_date:    validatedOnboardingDate,
            cost_limit:         row.cost_limit            || null,
            dob:                validatedDob,
            gender:             normalizedGender,
            analytics_enabled:  row.analytics_enabled    ?? false,
          }, tx);

          await studentRepository.incrementSchoolStudentCount(school_id, 1, tx);
        }

        // ── 10b. Class + section upsert ─────────────────────────────────────
        //
        //  student_class_section has student_id as its sole PRIMARY KEY — meaning
        //  a student can only have ONE active enrolment row at a time.
        //
        //  Lookup is by student_id ONLY (not class+section), so we always find
        //  the existing row even if the student is changing class or section.
        //
        //  FOUND  →  diff ALL fields (class_id, section_id, roll_number,
        //             academic_year, status) and update only what changed
        //  NOT FOUND  →  insert fresh row (brand-new student)
        //
        const existingEnrolment = await studentRepository.findClassSectionEnrolmentByStudent(
          student.student_id, tx
        );

        if (existingEnrolment) {
          const enrolmentUpdates: Record<string, any> = {};

          // Update class / section if the student has moved
          if (resolvedClassId !== (existingEnrolment as any).class_id)
            enrolmentUpdates.class_id = resolvedClassId;
          if (resolvedSectionId !== (existingEnrolment as any).section_id)
            enrolmentUpdates.section_id = resolvedSectionId;

          if (row.roll_number !== undefined &&
              String(row.roll_number || "") !== String((existingEnrolment as any).roll_number || ""))
            enrolmentUpdates.roll_number = row.roll_number || null;

          if (row.academic_year !== undefined &&
              String(row.academic_year || "") !== String((existingEnrolment as any).academic_year || ""))
            enrolmentUpdates.academic_year = row.academic_year || null;

          // Re-upload always re-activates an inactive enrolment
          if ((existingEnrolment as any).status !== "active")
            enrolmentUpdates.status = "active";

          if (Object.keys(enrolmentUpdates).length)
            await studentRepository.updateClassSectionEnrolmentByStudent(
              student.student_id, enrolmentUpdates, tx
            );
        } else {
          await studentRepository.createClassSection({
            student_id:    student.student_id,
            class_id:      resolvedClassId,
            section_id:    resolvedSectionId,
            roll_number:   row.roll_number   || null,
            academic_year: row.academic_year || null,
            status:        "active",
          }, tx);
        }

        // ── 11. Parent — upsert logic ─────────────────────────────────────────
        //
        //  EXISTS  → update User + ParentProfile fields that have changed
        //  NEW     → create User + ParentProfile
        //
        let parent: any;
        let isNewParent    = false;
        let plainParentPassword = "";
        let parentUsername      = "";

        const existingParentUser = await studentRepository.findUserByNameAndPhone(parentFullName, parentPhone, tx);

        if (existingParentUser) {
          // ── Existing parent: update changed fields ───────────────────────
          const existingParent = await studentRepository.findParentProfileByUserId(
            (existingParentUser as any).user_id, tx
          );
          if (!existingParent)
            throw new Error(
              `User "${parentFullName}" (${parentPhone}) exists but has no ParentProfile. ` +
              `Please check their account manually.`
            );

          const parentUserUpdates: Record<string, any> = {};
          if (parentEmailRaw !== undefined && parentEmailRaw !== (existingParentUser as any).email)
            parentUserUpdates.email   = parentEmailRaw;
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
          // ── New parent: create ───────────────────────────────────────────
          isNewParent         = true;
          plainParentPassword = generatePassword();
          parentUsername      = generateUsername(parentFullName);

          const resolvedParentAddress = row.parent_address || row.student_address || null;
          const parentHashed          = await bcrypt.hash(plainParentPassword, 10);

          const parentUser = await studentRepository.createUser({
            username:     parentUsername,
            full_name:    parentFullName,
            password:     parentHashed,
            phone_number: parentPhone,
            email:        parentEmailRaw || null,
            address:      resolvedParentAddress,
            role_id:      parentRole.role_id,
            school_id,    status: "Active",
            is_password_reset_required: true,
          }, tx);

          parent = await studentRepository.createParentProfile({
            user_id:  parentUser.user_id,
            school_id,
            relation: normalizedRelation,
          }, tx);
        }

        // ── 12. Parent ↔ student mapping ──────────────────────────────────────
        const mappingExists = await studentRepository.findParentStudentMapping(
          BigInt(parent.parent_id), BigInt(student.student_id), tx
        );
        if (!mappingExists) {
          await studentRepository.createParentStudentMap(
            { parent_id: BigInt(parent.parent_id), student_id: BigInt(student.student_id) }, tx
          );
        }

        await tx.commit();

        // Count as "updated" if an existing record was changed, "created" if net-new
        if (isNewStudent || isNewParent) {
          createdCount++;
        } else {
          updatedCount++;
        }

        // Welcome emails only for brand-new accounts
        if (isNewStudent && studentEmailRaw)
          emailQueue.push({ to: studentEmailRaw, name: studentFullName, username: studentUsername, password: plainStudentPassword });
        if (isNewParent && parentEmailRaw)
          emailQueue.push({ to: parentEmailRaw, name: parentFullName, username: parentUsername, password: plainParentPassword });

      } catch (err: any) {
        await tx.rollback();
        failedCount++;

        // ── Detailed error log — shows exactly what failed and the raw row data ──
        const sqlMsg   = err?.parent?.sqlMessage;
        const rawMsg: string = sqlMsg ?? err?.message ?? "Unknown error";

        console.error(`\n[BulkUpload] ❌ ${rowLabel} FAILED`);
        console.error(`[BulkUpload]   Error type   : ${err?.name ?? typeof err}`);
        console.error(`[BulkUpload]   Message      : ${rawMsg}`);

        // SQL-level error — show extra DB detail
        if (sqlMsg) {
          console.error(`[BulkUpload]   SQL errno    : ${err?.parent?.errno}`);
          console.error(`[BulkUpload]   SQL code     : ${err?.parent?.code}`);
          console.error(`[BulkUpload]   SQL state    : ${err?.parent?.sqlState}`);
          console.error(`[BulkUpload]   Full SQL msg : ${sqlMsg}`);
        }

        // Validation error — Sequelize field-level detail
        if (err?.errors?.length) {
          err.errors.forEach((e: any, i: number) => {
            console.error(`[BulkUpload]   Validation[${i}]: field="${e.path}" value=${JSON.stringify(e.value)} msg="${e.message}"`);
          });
        }

        // Raw row dump — shows exactly what came from the Excel file
        console.error(`[BulkUpload]   Raw row data:`);
        const sensitiveKeys = new Set(["password"]);
        Object.entries(row as Record<string, any>).forEach(([k, v]) => {
          if (!sensitiveKeys.has(k)) {
            console.error(`[BulkUpload]     ${k.padEnd(25)} = ${JSON.stringify(v)}  (type: ${typeof v}${v instanceof Date ? " [Date]" : ""})`);
          }
        });

        // Stack trace for unexpected errors (not validation/DB errors)
        if (!sqlMsg && err?.name !== "SequelizeValidationError") {
          console.error(`[BulkUpload]   Stack: ${err?.stack}`);
        }

        console.error(`[BulkUpload] ─────────────────────────────────────────────\n`);

        rowErrors.push({ row: rowLabel, message: rawMsg });
      }
    }

    // ── Upload summary log ──────────────────────────────────────────────────────
    console.log(`\n[BulkUpload] ══════════════ UPLOAD COMPLETE ══════════════`);
    console.log(`[BulkUpload]   Total rows processed : ${records.length}`);
    console.log(`[BulkUpload]   ✅ Created            : ${createdCount}`);
    console.log(`[BulkUpload]   ✏️  Updated            : ${updatedCount}`);
    console.log(`[BulkUpload]   ❌ Failed             : ${failedCount}`);
    if (rowErrors.length) {
      console.error(`[BulkUpload]   Row errors:`);
      rowErrors.forEach(e => console.error(`[BulkUpload]     • ${e.row}: ${e.message}`));
    }
    console.log(`[BulkUpload] ═══════════════════════════════════════════════\n`);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    for (const entry of emailQueue) {
      sendWelcomeEmail(entry.to, entry.name, entry.username, entry.password).catch(
        (err) => console.error(`[Mailer] Welcome email to ${entry.to} failed:`, err)
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
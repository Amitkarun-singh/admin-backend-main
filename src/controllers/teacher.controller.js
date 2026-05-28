import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";

import User from "../models/user.model.js";
import AdminRole from "../models/admin_role.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";
import TeacherAnalytics from "../models/teacher_analytics.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSubject from "../models/admin_subject_master.model.js";
import AdminSection from "../models/admin_section.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseExcel } from "../utils/excel.util.js";

/* =====================================================
   SHARED HELPER — fetch secondary subjects
   ===================================================== */
const fetchSecondarySubjects = async (rawIds) => {
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
};

/* =====================================================
   SHARED HELPER — standard include block for teacher queries
   Mirrors exactly how student controller includes classSection
   ===================================================== */
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
    // ← This is the key fix: use hasMany association defined in associations file
    model: TeacherClassSectionSubject,
    as: "assignments",
    attributes: ["id", "class_id", "section_id", "class_subject_id", "academic_year"],
    include: [
      { model: AdminClass,   as: "class",   attributes: ["class_id", "class_name"]       },
      { model: AdminSection, as: "section", attributes: ["section_id", "section_name"]   },
      { model: AdminSubject, as: "subject", attributes: ["subject_id", "subject_name", "board", "language"] },
    ],
  },
];

/* =====================================================
   SHARED HELPER — build + insert TeacherClassSectionSubject rows
   ===================================================== */
const buildAndInsertAssignments = async (
  teacherId,
  { primary_subject_id, section_id, secondary_subject_ids, secondary_section_ids },
  transaction
) => {
  const academicYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
  const assignmentRows = [];

  if (primary_subject_id && section_id) {
    const primarySubject = await AdminSubject.findByPk(primary_subject_id, { transaction });
    if (primarySubject) {
      assignmentRows.push({
        teacher_id:       Number(teacherId),
        class_id:         primarySubject.class_id,
        section_id:       Number(section_id),
        class_subject_id: Number(primary_subject_id),
        academic_year:    academicYear,
      });
    }
  }

  if (Array.isArray(secondary_subject_ids) && secondary_subject_ids.length) {
    const secSubjects = await AdminSubject.findAll({
      where: { subject_id: secondary_subject_ids },
      transaction,
    });
    for (let i = 0; i < secondary_subject_ids.length; i++) {
      const subjectId       = Number(secondary_subject_ids[i]);
      const sectionIdForSub = secondary_section_ids?.[i] ? Number(secondary_section_ids[i]) : null;
      const subjectRecord   = secSubjects.find((s) => Number(s.subject_id) === subjectId);
      if (!subjectRecord || !sectionIdForSub) continue;
      assignmentRows.push({
        teacher_id:       Number(teacherId),
        class_id:         subjectRecord.class_id,
        section_id:       sectionIdForSub,
        class_subject_id: subjectId,
        academic_year:    academicYear,
      });
    }
  }

  if (assignmentRows.length) {
    await TeacherClassSectionSubject.bulkCreate(assignmentRows, { transaction });
  }
  return assignmentRows;
};

/* =====================================================
   SHARED HELPER — resolve class_name → ids
   ===================================================== */
const resolveClassSubjectSection = async (
  { class_name, subject_name, section_name },
  school,
  transaction
) => {
  let resolvedClassId   = null;
  let resolvedSubjectId = null;
  let resolvedSectionId = null;

  if (!class_name) return { resolvedClassId, resolvedSubjectId, resolvedSectionId };

  const classRecord = await AdminClass.findOne({ where: { class_name }, transaction });
  if (!classRecord) return { resolvedClassId, resolvedSubjectId, resolvedSectionId };
  resolvedClassId = classRecord.class_id;

  if (subject_name) {
    const subjectRecord = await AdminSubject.findOne({
      where: {
        class_id:     resolvedClassId,
        subject_name,
        board:        school.board,
        language:     school.language_preference,
      },
      transaction,
    });
    resolvedSubjectId = subjectRecord?.subject_id ?? null;
  }

  if (section_name) {
    const sectionRecord = await AdminSection.findOne({
      where: { class_id: resolvedClassId, section_name },
      transaction,
    });
    resolvedSectionId = sectionRecord?.section_id ?? null;
  }

  return { resolvedClassId, resolvedSubjectId, resolvedSectionId };
};

/* =====================================================
   CREATE TEACHER
   ===================================================== */
const createTeacher = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;
  const school = await AdminSchool.findByPk(school_id);
  if (!school) throw new ApiError(404, "School not found");

  const {
    username, password, phone_number, email, full_name, gender, preferred_language,
    class_name, subject_name, section_name,
    primary_subject_id, section_id,
    secondary_subject_ids, secondary_section_ids,
    experience, age, onboarding_date, school_tenure,
    device_type, device_access, ppt_generation_enabled, cost_limit, qualification,
  } = req.body;

  if (!username || !password)
    throw new ApiError(400, "Username and password required");

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({ where: { role_name: "TEACHER" }, transaction });
    if (!role) throw new ApiError(400, "Teacher role not found");

    let finalSubjectId = primary_subject_id || null;
    let finalSectionId = section_id         || null;

    if (!finalSubjectId && class_name) {
      const resolved = await resolveClassSubjectSection(
        { class_name, subject_name, section_name },
        school,
        transaction
      );
      finalSubjectId = resolved.resolvedSubjectId;
      finalSectionId = resolved.resolvedSectionId;
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create(
      {
        username,
        full_name:                  full_name    || null,
        password:                   hashed,
        phone_number:               phone_number || null,
        email:                      email        || null,
        role_id:                    role.role_id,
        school_id,
        status:                     "Active",
        is_password_reset_required: true,
      },
      { transaction }
    );

    const teacher = await TeacherProfile.create(
      {
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
      },
      { transaction }
    );

    await buildAndInsertAssignments(
      teacher.teacher_id,
      {
        primary_subject_id:    finalSubjectId,
        section_id:            finalSectionId,
        secondary_subject_ids: secondary_subject_ids || [],
        secondary_section_ids: secondary_section_ids || [],
      },
      transaction
    );

    await AdminSchool.increment("teacher_count", { by: 1, where: { school_id }, transaction });
    await transaction.commit();

    // Re-fetch with full includes so response has assignments populated
    const created = await TeacherProfile.findByPk(teacher.teacher_id, {
      include: teacherIncludes,
    });
    const secondarySubjects = await fetchSecondarySubjects(created.secondary_subject_ids);

    return res.status(201).json(
      new ApiResponse(201, { ...created.toJSON(), secondarySubjects }, "Teacher created successfully")
    );
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/* =====================================================
   BULK TEACHER UPLOAD
   ===================================================== */
const bulkTeacherUpload = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;
  const file      = req.file;

  console.log("📥 Bulk upload started for school_id:", school_id);

  const school = await AdminSchool.findOne({ where: { school_id } });
  if (!school) throw new ApiError(400, "School not found");
  if (!file)   throw new ApiError(400, "Excel file required");

  console.log("🏫 School found:", { school_id: school.school_id, board: school.board, language: school.language_preference });

  const records = parseExcel(file.path);
  if (!records.length) throw new ApiError(400, "Excel file is empty");

  console.log(`📊 Total rows parsed from Excel: ${records.length}`);
  console.log("📋 First row sample:", records[0]);

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({ where: { role_name: "TEACHER" }, transaction });
    if (!role) throw new ApiError(400, "Teacher role not found");
    console.log("✅ Teacher role found:", role.role_id);

    let createdCount = 0;

    for (const [index, row] of records.entries()) {
      const rowLabel = `Row ${index + 2}`;
      console.log(`\n─────────────────────────────────────`);
      console.log(`📝 Processing ${rowLabel}:`, JSON.stringify(row));

      if (!row.username || !row.password)
        throw new ApiError(400, `${rowLabel}: Missing username or password`);

      let resolvedClassId   = null;
      let resolvedSubjectId = null;
      let resolvedSectionId = null;

      // ── Step 1: Resolve class ─────────────────────────────────────
      console.log(`🔍 [${rowLabel}] Step 1 — Looking up class_name: "${row.class_name}"`);

      if (row.class_name) {
        const classRecord = await AdminClass.findOne({
          where: { class_name: row.class_name },
          transaction,
        });

        if (!classRecord) {
          console.warn(`⚠️  [${rowLabel}] Class NOT found for name: "${row.class_name}"`);
        } else {
          resolvedClassId = classRecord.class_id;
          console.log(`✅ [${rowLabel}] Class found: class_id=${resolvedClassId}, class_name="${classRecord.class_name}"`);

          // ── Step 2: Resolve subject ───────────────────────────────
          console.log(`🔍 [${rowLabel}] Step 2 — Looking up subject_name: "${row.subject_name}" with class_id=${resolvedClassId}, board="${school.board}", language="${school.language_preference}"`);

          if (row.subject_name) {
            const subjectRecord = await AdminSubject.findOne({
              where: {
                class_id:     resolvedClassId,
                subject_name: row.subject_name,
                board:        school.board,
                language:     school.language_preference,
              },
              transaction,
            });

            if (!subjectRecord) {
              console.warn(`⚠️  [${rowLabel}] Subject NOT found for name: "${row.subject_name}", class_id=${resolvedClassId}, board="${school.board}", language="${school.language_preference}"`);

              // Extra debug — show what subjects DO exist for this class
              const availableSubjects = await AdminSubject.findAll({
                where: { class_id: resolvedClassId },
                attributes: ["subject_id", "subject_name", "board", "language"],
                transaction,
              });
              console.log(`📋 [${rowLabel}] Available subjects for class_id=${resolvedClassId}:`, availableSubjects.map(s => ({ id: s.subject_id, name: s.subject_name, board: s.board, language: s.language })));
            } else {
              resolvedSubjectId = subjectRecord.subject_id;
              console.log(`✅ [${rowLabel}] Subject found: subject_id=${resolvedSubjectId}, subject_name="${subjectRecord.subject_name}"`);
            }
          } else {
            console.log(`⏭️  [${rowLabel}] No subject_name in row — skipping subject lookup`);
          }

          // ── Step 3: Resolve section ───────────────────────────────
          console.log(`🔍 [${rowLabel}] Step 3 — Looking up section_name: "${row.section_name}" with class_id=${resolvedClassId}`);

          if (row.section_name) {
            const sectionRecord = await AdminSection.findOne({
              where: {
                class_id:     resolvedClassId,
                section_name: row.section_name,
              },
              transaction,
            });

            if (!sectionRecord) {
              console.warn(`⚠️  [${rowLabel}] Section NOT found for name: "${row.section_name}", class_id=${resolvedClassId}`);

              // Extra debug — show what sections DO exist for this class
              const availableSections = await AdminSection.findAll({
                where: { class_id: resolvedClassId },
                attributes: ["section_id", "section_name"],
                transaction,
              });
              console.log(`📋 [${rowLabel}] Available sections for class_id=${resolvedClassId}:`, availableSections.map(s => ({ id: s.section_id, name: s.section_name })));
            } else {
              resolvedSectionId = sectionRecord.section_id;
              console.log(`✅ [${rowLabel}] Section found: section_id=${resolvedSectionId}, section_name="${sectionRecord.section_name}"`);
            }
          } else {
            console.log(`⏭️  [${rowLabel}] No section_name in row — skipping section lookup`);
          }
        }
      } else {
        console.log(`⏭️  [${rowLabel}] No class_name in row — skipping class/subject/section lookup`);
      }

      console.log(`📌 [${rowLabel}] Resolved IDs — class_id: ${resolvedClassId}, subject_id: ${resolvedSubjectId}, section_id: ${resolvedSectionId}`);

      // ── Step 4: Create user ───────────────────────────────────────
      console.log(`👤 [${rowLabel}] Step 4 — Creating user: "${row.username}"`);
      const hashed = await bcrypt.hash(String(row.password), 10);

      const user = await User.create(
        {
          username:                   row.username,
          full_name:                  row.full_name    || null,
          password:                   hashed,
          phone_number:               row.phone_number || null,
          email:                      row.email        || null,
          role_id:                    role.role_id,
          school_id,
          status:                     "Active",
          is_password_reset_required: true,
        },
        { transaction }
      );
      console.log(`✅ [${rowLabel}] User created: user_id=${user.user_id}`);

      // ── Step 5: Create teacher profile ────────────────────────────
      console.log(`🧑‍🏫 [${rowLabel}] Step 5 — Creating teacher profile with primary_subject_id=${resolvedSubjectId}`);

      const teacher = await TeacherProfile.create(
        {
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
        },
        { transaction }
      );
      console.log(`✅ [${rowLabel}] Teacher profile created: teacher_id=${teacher.teacher_id}`);

      // ── Step 6: Insert assignment row ─────────────────────────────
      console.log(`📎 [${rowLabel}] Step 6 — Inserting assignment: teacher_id=${teacher.teacher_id}, subject_id=${resolvedSubjectId}, section_id=${resolvedSectionId}`);

      const assignmentRows = await buildAndInsertAssignments(
        teacher.teacher_id,
        {
          primary_subject_id:    resolvedSubjectId || null,
          section_id:            resolvedSectionId || null,
          secondary_subject_ids: [],
          secondary_section_ids: [],
        },
        transaction
      );

      if (assignmentRows.length === 0) {
        console.warn(`⚠️  [${rowLabel}] No assignment rows inserted — likely because subject_id or section_id is null`);
      } else {
        console.log(`✅ [${rowLabel}] Assignment inserted:`, assignmentRows);
      }

      createdCount++;
      console.log(`🎉 [${rowLabel}] Done — total created so far: ${createdCount}`);
    }

    await AdminSchool.increment("teacher_count", { by: createdCount, where: { school_id }, transaction });
    await transaction.commit();
    fs.unlinkSync(file.path);

    console.log(`\n✅ Bulk upload complete — ${createdCount} teachers created for school_id=${school_id}`);

    return res.status(201).json(
      new ApiResponse(201, { created: createdCount }, "Teachers uploaded successfully")
    );
  } catch (error) {
    console.error("❌ Bulk upload failed — rolling back transaction");
    console.error("Error:", error.message);
    await transaction.rollback();
    if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    throw error;
  }
});

/* =====================================================
   GET ALL TEACHERS
   ===================================================== */
const getAllTeachers = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const teachers = await TeacherProfile.findAll({
    where: { school_id },
    include: teacherIncludes,
  });

  const enriched = await Promise.all(
    teachers.map(async (teacher) => {
      const secondarySubjects = await fetchSecondarySubjects(teacher.secondary_subject_ids);
      return { ...teacher.toJSON(), secondarySubjects };
    })
  );

  return res.status(200).json(new ApiResponse(200, enriched, "Teachers fetched"));
});

/* =====================================================
   GET SINGLE TEACHER
   ===================================================== */
const getTeacherById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id, {
    include: teacherIncludes,
  });

  if (!teacher) throw new ApiError(404, "Teacher not found");

  const secondarySubjects = await fetchSecondarySubjects(teacher.secondary_subject_ids);

  return res.status(200).json(
    new ApiResponse(200, { ...teacher.toJSON(), secondarySubjects }, "Teacher fetched")
  );
});

/* =====================================================
   UPDATE TEACHER
   ===================================================== */
const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id);
  if (!teacher) throw new ApiError(404, "Teacher not found");

  const school = await AdminSchool.findByPk(teacher.school_id);

  const {
    user_id, school_id,
    class_name, subject_name, section_name,
    primary_subject_id, section_id,
    secondary_subject_ids, secondary_section_ids,
    ...profileUpdates
  } = req.body;

  const transaction = await sequelize.transaction();

  try {
    let finalSubjectId = primary_subject_id ?? undefined;
    let finalSectionId = section_id         ?? undefined;

    if (class_name) {
      const resolved = await resolveClassSubjectSection(
        { class_name, subject_name, section_name },
        school,
        transaction
      );
      finalSubjectId = resolved.resolvedSubjectId;
      finalSectionId = resolved.resolvedSectionId;
    }

    await teacher.update(
      {
        ...profileUpdates,
        ...(finalSubjectId        !== undefined && { primary_subject_id: finalSubjectId }),
        ...(secondary_subject_ids !== undefined && { secondary_subject_ids }),
      },
      { transaction }
    );

    const hasAssignmentData =
      finalSubjectId        !== undefined ||
      finalSectionId        !== undefined ||
      secondary_subject_ids !== undefined ||
      secondary_section_ids !== undefined;

    if (hasAssignmentData) {
      await TeacherClassSectionSubject.destroy({ where: { teacher_id: id }, transaction });
      await buildAndInsertAssignments(
        id,
        {
          primary_subject_id:    finalSubjectId    ?? teacher.primary_subject_id,
          section_id:            finalSectionId,
          secondary_subject_ids: secondary_subject_ids ?? teacher.secondary_subject_ids,
          secondary_section_ids,
        },
        transaction
      );
    }

    await transaction.commit();

    // Re-fetch with full includes so response has updated assignments
    const updated = await TeacherProfile.findByPk(id, { include: teacherIncludes });
    const secondarySubjects = await fetchSecondarySubjects(updated.secondary_subject_ids);

    return res.status(200).json(
      new ApiResponse(200, { ...updated.toJSON(), secondarySubjects }, "Teacher updated successfully")
    );
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/* =====================================================
   DELETE TEACHER
   ===================================================== */
const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const transaction = await sequelize.transaction();

  try {
    const teacher = await TeacherProfile.findByPk(id, { transaction });
    if (!teacher) throw new ApiError(404, "Teacher not found");

    const { school_id, user_id } = teacher;

    await TeacherClassSectionSubject.destroy({ where: { teacher_id: id }, transaction });
    await TeacherAnalytics.destroy(          { where: { teacher_id: id }, transaction });
    await teacher.destroy({ transaction });
    await User.destroy({ where: { user_id }, transaction });

    await AdminSchool.increment("teacher_count", { by: -1, where: { school_id }, transaction });
    await transaction.commit();

    return res.status(200).json(new ApiResponse(200, null, "Teacher deleted successfully"));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

export {
  createTeacher,
  bulkTeacherUpload,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
};
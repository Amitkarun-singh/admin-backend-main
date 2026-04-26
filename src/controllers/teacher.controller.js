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
   CREATE TEACHER
   ===================================================== */
const createTeacher = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;
  const school = await AdminSchool.findByPk(school_id);
  if (!school) throw new ApiError(404, "School not found");

  const {
    username, password, phone_number, email, full_name,
    primary_subject_id, secondary_subject_ids,
    experience, age, onboarding_date, school_tenure,
    device_type, device_access, ppt_generation_enabled, cost_limit,
  } = req.body;

  if (!username || !password)
    throw new ApiError(400, "Username and password required");

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({ where: { role_name: "TEACHER" }, transaction });
    if (!role) throw new ApiError(400, "Teacher role not found");

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
        is_password_reset_required: true,   // ✅ admin-created → must reset on first login
      },
      { transaction }
    );

    const teacher = await TeacherProfile.create(
      {
        user_id:                user.user_id,
        school_id,
        primary_subject_id:     primary_subject_id    || null,
        secondary_subject_ids:  secondary_subject_ids || null,
        experience:             experience            || null,
        age:                    age                   || null,
        onboarding_date:        onboarding_date       || null,
        school_tenure:          school_tenure         || null,
        device_type:            device_type           || null,
        device_access:          device_access         || null,
        ppt_generation_enabled: ppt_generation_enabled ?? false,
        cost_limit:             cost_limit            || null,
      },
      { transaction }
    );

    await AdminSchool.increment("teacher_count", { by: 1, where: { school_id }, transaction });

    await transaction.commit();

    return res.status(201).json(new ApiResponse(201, teacher, "Teacher created successfully"));
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

  const school = await AdminSchool.findOne({ where: { school_id } });
  if (!school) throw new ApiError(400, "School not found");
  if (!file)   throw new ApiError(400, "Excel file required");

  const records = parseExcel(file.path);
  if (!records.length) throw new ApiError(400, "Excel file is empty");

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({ where: { role_name: "TEACHER" }, transaction });
    if (!role) throw new ApiError(400, "Teacher role not found");

    let createdCount = 0;

    for (const [index, row] of records.entries()) {
      if (!row.username || !row.password)
        throw new ApiError(400, `Row ${index + 2}: Missing username or password`);

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
          is_password_reset_required: true,   // ✅
        },
        { transaction }
      );

      let primarySubjectId = null;

      if (row.class_name && row.subject_name) {
        const classRecord = await AdminClass.findOne({ where: { class_name: row.class_name }, transaction });
        if (classRecord) {
          const primarySubject = await AdminSubject.findOne({
            where: {
              class_id:     classRecord.class_id,
              subject_name: row.subject_name,
              board:        school.board,
              language:     school.language_preference,
            },
            transaction,
          });
          primarySubjectId = primarySubject?.subject_id ?? null;
        }
      }

      await TeacherProfile.create(
        {
          user_id:                user.user_id,
          school_id,
          primary_subject_id:     primarySubjectId,
          secondary_subject_ids:  row.secondary_subject_ids || null,
          experience:             row.experience            || null,
          age:                    row.age                   || null,
          onboarding_date:        row.onboarding_date       || null,
          school_tenure:          row.school_tenure         || null,
          device_type:            row.device_type           || null,
          device_access:          row.device_access         || null,
          ppt_generation_enabled: row.ppt_generation_enabled ?? false,
          cost_limit:             row.cost_limit            || null,
        },
        { transaction }
      );

      createdCount++;
    }

    await AdminSchool.increment("teacher_count", { by: createdCount, where: { school_id }, transaction });
    await transaction.commit();
    fs.unlinkSync(file.path);

    return res.status(201).json(new ApiResponse(201, { created: createdCount }, "Teachers uploaded successfully"));
  } catch (error) {
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
    include: [
      {
        model: User,
        as: "user",
        attributes: ["username", "full_name", "phone_number", "email", "status"],
      },
      {
        model: AdminSubject,
        as: "primarySubject",
        attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
        required: false,
        include: [{ model: AdminClass, as: "class", attributes: ["class_id", "class_name"] }],
      },
    ],
  });

  const teachersWithSecondary = await Promise.all(
    teachers.map(async (teacher) => {
      let secondarySubjects = [];
      if (teacher.secondary_subject_ids?.length) {
        secondarySubjects = await AdminSubject.findAll({
          where: { subject_id: teacher.secondary_subject_ids },
          attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
          include: [{ model: AdminClass, as: "class", attributes: ["class_id", "class_name"] }],
        });
      }
      return { ...teacher.toJSON(), secondarySubjects };
    })
  );

  return res.status(200).json(new ApiResponse(200, teachersWithSecondary, "Teachers fetched"));
});

/* =====================================================
   GET SINGLE TEACHER
   ===================================================== */
const getTeacherById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id, {
    include: [
      {
        model: User,
        as: "user",
        attributes: ["username", "full_name", "phone_number", "email", "status"],
      },
      {
        model: AdminSubject,
        as: "primarySubject",
        attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
        required: false,
        include: [{ model: AdminClass, as: "class", attributes: ["class_id", "class_name"] }],
      },
    ],
  });

  if (!teacher) throw new ApiError(404, "Teacher not found");

  let secondarySubjects = [];
  if (teacher.secondary_subject_ids?.length) {
    secondarySubjects = await AdminSubject.findAll({
      where: { subject_id: teacher.secondary_subject_ids },
      attributes: ["subject_id", "subject_name", "board", "language", "class_id"],
      include: [{ model: AdminClass, as: "class", attributes: ["class_id", "class_name"] }],
    });
  }

  return res.status(200).json(new ApiResponse(200, { ...teacher.toJSON(), secondarySubjects }, "Teacher fetched"));
});

/* =====================================================
   UPDATE TEACHER
   ===================================================== */
const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id);
  if (!teacher) throw new ApiError(404, "Teacher not found");

  const { user_id, school_id, ...allowedUpdates } = req.body;

  await teacher.update(allowedUpdates);

  return res.status(200).json(new ApiResponse(200, teacher, "Teacher updated successfully"));
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
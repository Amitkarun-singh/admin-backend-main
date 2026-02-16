import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";

import AdminUser from "../models/admin_user.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import AdminSchool from "../models/admin_school.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseExcel } from "../utils/excel.util.js";
import TeacherClassSectionSubject from "../models/teacher_class_section_subject.model.js";
import TeacherAnalytics from "../models/teacher_analytics.model.js";

/* =====================================================
   CREATE TEACHER
   ===================================================== */
const createTeacher = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const {
    username,
    password,
    phone_number,
    email,
    primary_subject_id,
    experience,
    age,
    device_type,
    cost_limit
  } = req.body;

  if (!username || !password)
    throw new ApiError(400, "Username and password required");

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({
      where: { role_name: "TEACHER" },
      transaction
    });

    if (!role) throw new ApiError(400, "Teacher role not found");

    const hashed = await bcrypt.hash(password, 10);

    const user = await AdminUser.create(
      {
        username,
        password: hashed,
        phone_number,
        email,
        role_id: role.role_id,
        school_id,
        status: "active"
      },
      { transaction }
    );

    const teacher = await TeacherProfile.create(
      {
        user_id: user.user_id,
        school_id,
        primary_subject_id,
        experience,
        age,
        device_type,
        cost_limit,
        status: "pending"
      },
      { transaction }
    );

    await AdminSchool.increment("teacher_count", {
      by: 1,
      where: { school_id },
      transaction
    });

    await transaction.commit();

    return res
      .status(201)
      .json(new ApiResponse(201, teacher, "Teacher created"));
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
  const file = req.file;

  if (!file) throw new ApiError(400, "Excel file required");

  const records = parseExcel(file.path);
  if (!records.length) throw new ApiError(400, "Excel file is empty");

  const transaction = await sequelize.transaction();

  try {
    const role = await AdminRole.findOne({
      where: { role_name: "TEACHER" },
      transaction
    });

    if (!role) throw new ApiError(400, "Teacher role not found");

    let createdCount = 0;

    for (const [index, row] of records.entries()) {
      if (!row.username || !row.password) {
        throw new ApiError(
          400,
          `Row ${index + 2}: Missing username or password`
        );
      }

      const hashed = await bcrypt.hash(String(row.password), 10);

      const user = await AdminUser.create(
        {
          username: row.username,
          password: hashed,
          phone_number: row.phone_number || null,
          email: row.email || null,
          role_id: role.role_id,
          school_id,
          status: "active"
        },
        { transaction }
      );

      await TeacherProfile.create(
        {
          user_id: user.user_id,
          school_id,
          primary_subject_id: row.primary_subject_id || null,
          experience: row.experience || null,
          age: row.age || null,
          device_type: row.device_type || null,
          cost_limit: row.cost_limit || null,
          status: "pending"
        },
        { transaction }
      );

      createdCount++;
    }

    await AdminSchool.increment("teacher_count", {
      by: createdCount,
      where: { school_id },
      transaction
    });

    await transaction.commit();
    fs.unlinkSync(file.path);

    return res.status(201).json(
      new ApiResponse(201, null, "Teachers uploaded successfully")
    );
  } catch (error) {
    await transaction.rollback();
    fs.unlinkSync(file.path);
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
        model: AdminUser,
        as: "user",
        attributes: ["username", "phone_number", "email", "status"]
      }
    ]
  });

  return res
    .status(200)
    .json(new ApiResponse(200, teachers, "Teachers fetched"));
});

/* =====================================================
   GET SINGLE TEACHER
   ===================================================== */
const getTeacherById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id, {
    include: [
      {
        model: AdminUser,
        as: "user",
        attributes: ["username", "phone_number", "email", "status"]
      }
    ]
  });

  if (!teacher)
    throw new ApiError(404, "Teacher not found");

  return res
    .status(200)
    .json(new ApiResponse(200, teacher));
});

/* =====================================================
   UPDATE TEACHER
   ===================================================== */
const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await TeacherProfile.findByPk(id);
  if (!teacher)
    throw new ApiError(404, "Teacher not found");

  await teacher.update(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, teacher, "Teacher updated"));
});

/* =====================================================
   DELETE TEACHER
   ===================================================== */
const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();

  try {
    const teacher = await TeacherProfile.findByPk(id, { transaction });
    if (!teacher)
      throw new ApiError(404, "Teacher not found");

    const school_id = teacher.school_id;
    const user_id = teacher.user_id;

    // 1️⃣ Delete class-section-subject mapping
    await TeacherClassSectionSubject.destroy({
      where: { teacher_id: id },
      transaction
    });

    // 2️⃣ Delete analytics
    await TeacherAnalytics.destroy({
      where: { teacher_id: id },
      transaction
    });

    // 3️⃣ Delete teacher profile
    await teacher.destroy({ transaction });

    // 4️⃣ Delete user
    await AdminUser.destroy({
      where: { user_id },
      transaction
    });

    // 5️⃣ Decrement school teacher count
    await AdminSchool.increment("teacher_count", {
      by: -1,
      where: { school_id },
      transaction
    });

    await transaction.commit();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Teacher deleted successfully"));

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
  deleteTeacher
};

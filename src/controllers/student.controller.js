import bcrypt from "bcrypt";
import sequelize from "../config/db.js";
import fs from "fs";

import AdminUser from "../models/admin_user.model.js";
import AdminRole from "../models/admin_role.model.js";
import StudentProfile from "../models/student_profile.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import StudentAnalytics from "../models/student_analytics.model.js";
import AdminSchool from "../models/admin_school.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseExcel } from "../utils/excel.util.js";

/* =====================================================
   CREATE STUDENT
   ===================================================== */
const createStudent = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const {
    student_username,
    student_password,
    student_phone,
    student_email,

    parent_username,
    parent_password,
    parent_phone,
    parent_email,

    parent_name,
    relation,
    class_id,
    section_id,
    roll_number,
    academic_year,

    preferred_language,
    onboarding_date,
    cost_limit,
    dob,
    gender,
    analytics_enabled
  } = req.body;

  if (!student_username || !student_password || !parent_username)
    throw new ApiError(400, "Required fields missing");

  const transaction = await sequelize.transaction();

  try {
    const studentRole = await AdminRole.findOne({
      where: { role_name: "STUDENT" },
      transaction
    });

    const parentRole = await AdminRole.findOne({
      where: { role_name: "PARENT" },
      transaction
    });

    if (!studentRole || !parentRole)
      throw new ApiError(400, "Student or Parent role missing");

    /* ================= Parent User ================= */
    const parentHashed = await bcrypt.hash(parent_password, 10);

    const parentUser = await AdminUser.create(
      {
        username: parent_username,
        password: parentHashed,
        phone_number: parent_phone || null,
        email: parent_email || null,
        role_id: parentRole.role_id,
        school_id,
        status: "active"
      },
      { transaction }
    );

    const parent = await ParentProfile.create(
      {
        user_id: parentUser.user_id,
        school_id,
        parent_name,
        relation,
        status: "active"
      },
      { transaction }
    );

    /* ================= Student User ================= */
    const studentHashed = await bcrypt.hash(student_password, 10);

    const studentUser = await AdminUser.create(
      {
        username: student_username,
        password: studentHashed,
        phone_number: student_phone || null,
        email: student_email || null,
        role_id: studentRole.role_id,
        school_id,
        status: "active"
      },
      { transaction }
    );

    const student = await StudentProfile.create(
      {
        user_id: studentUser.user_id,
        school_id,
        preferred_language,
        onboarding_date,
        cost_limit,
        dob,
        gender,
        analytics_enabled,
        status: "active"
      },
      { transaction }
    );

    /* ================= Mapping ================= */
    await ParentStudentMap.create(
      {
        parent_id: parent.parent_id,
        student_id: student.student_id
      },
      { transaction }
    );

    await StudentClassSection.create(
      {
        student_id: student.student_id,
        class_id,
        section_id,
        roll_number,
        academic_year,
        status: "active"
      },
      { transaction }
    );

    /* ================= School Count ================= */
    await AdminSchool.increment("student_count", {
      by: 1,
      where: { school_id },
      transaction
    });

    await transaction.commit();

    return res
      .status(201)
      .json(new ApiResponse(201, student, "Student created"));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/* =====================================================
   BULK STUDENT UPLOAD (EXCEL)
   ===================================================== */
const bulkStudentUpload = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;
  const file = req.file;

  if (!file) throw new ApiError(400, "Excel file required");

  const records = parseExcel(file.path);
  if (!records.length) throw new ApiError(400, "Excel file is empty");

  const transaction = await sequelize.transaction();

  try {
    const studentRole = await AdminRole.findOne({
      where: { role_name: "STUDENT" },
      transaction
    });

    const parentRole = await AdminRole.findOne({
      where: { role_name: "PARENT" },
      transaction
    });

    let createdCount = 0;

    for (const [index, row] of records.entries()) {
      if (
        !row.student_username ||
        !row.student_password ||
        !row.parent_username
      ) {
        throw new ApiError(
          400,
          `Row ${index + 2}: Missing required fields`
        );
      }

      /* Parent */
      const parentHashed = await bcrypt.hash(
        String(row.parent_password),
        10
      );

      const parentUser = await AdminUser.create(
        {
          username: row.parent_username,
          password: parentHashed,
          phone_number: row.parent_phone || null,
          email: row.parent_email || null,
          role_id: parentRole.role_id,
          school_id,
          status: "active"
        },
        { transaction }
      );

      const parent = await ParentProfile.create(
        {
          user_id: parentUser.user_id,
          school_id,
          parent_name: row.parent_name,
          relation: row.relation,
          status: "active"
        },
        { transaction }
      );

      /* Student */
      const studentHashed = await bcrypt.hash(
        String(row.student_password),
        10
      );

      const studentUser = await AdminUser.create(
        {
          username: row.student_username,
          password: studentHashed,
          phone_number: row.student_phone || null,
          email: row.student_email || null,
          role_id: studentRole.role_id,
          school_id,
          status: "active"
        },
        { transaction }
      );

      const student = await StudentProfile.create(
        {
          user_id: studentUser.user_id,
          school_id,
          preferred_language: row.preferred_language || null,
          onboarding_date: row.onboarding_date || null,
          cost_limit: row.cost_limit || null,
          dob: row.dob || null,
          gender: row.gender || null,
          analytics_enabled: row.analytics_enabled || false,
          status: "active"
        },
        { transaction }
      );

      await ParentStudentMap.create(
        {
          parent_id: parent.parent_id,
          student_id: student.student_id
        },
        { transaction }
      );

      await StudentClassSection.create(
        {
          student_id: student.student_id,
          class_id: row.class_id,
          section_id: row.section_id,
          roll_number: row.roll_number,
          academic_year: row.academic_year,
          status: "active"
        },
        { transaction }
      );

      createdCount++;
    }

    await AdminSchool.increment("student_count", {
      by: createdCount,
      where: { school_id },
      transaction
    });

    await transaction.commit();
    fs.unlinkSync(file.path);

    return res.status(201).json(
      new ApiResponse(201, null, "Students uploaded successfully")
    );
  } catch (error) {
    await transaction.rollback();
    fs.unlinkSync(file.path);
    throw error;
  }
});

/* =====================================================
   GET ALL STUDENTS
   ===================================================== */
const getAllStudents = asyncHandler(async (req, res) => {
  const school_id = req.user.school_id;

  const students = await StudentProfile.findAll({
    where: { school_id }
  });

  return res
    .status(200)
    .json(new ApiResponse(200, students));
});

/* =====================================================
   GET SINGLE STUDENT
   ===================================================== */
const getStudentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const student = await StudentProfile.findByPk(id);
  if (!student)
    throw new ApiError(404, "Student not found");

  return res
    .status(200)
    .json(new ApiResponse(200, student));
});

/* =====================================================
   UPDATE STUDENT
   ===================================================== */
const updateStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const student = await StudentProfile.findByPk(id);
  if (!student)
    throw new ApiError(404, "Student not found");

  await student.update(req.body);

  return res
    .status(200)
    .json(new ApiResponse(200, student, "Student updated"));
});

/* =====================================================
   DELETE STUDENT
   ===================================================== */
const deleteStudent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();

  try {
    const student = await StudentProfile.findByPk(id, { transaction });
    if (!student)
      throw new ApiError(404, "Student not found");

    const school_id = student.school_id;
    const user_id = student.user_id;

    await StudentClassSection.destroy({
      where: { student_id: id },
      transaction
    });

    await ParentStudentMap.destroy({
      where: { student_id: id },
      transaction
    });

    await StudentAnalytics.destroy({
      where: { student_id: id },
      transaction
    });

    await student.destroy({ transaction });

    await AdminUser.destroy({
      where: { user_id },
      transaction
    });

    await AdminSchool.increment("student_count", {
      by: -1,
      where: { school_id },
      transaction
    });

    await transaction.commit();

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Student deleted successfully"));
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

export {
  createStudent,
  bulkStudentUpload,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent
};

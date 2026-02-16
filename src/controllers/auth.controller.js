import bcrypt from "bcrypt";
import AdminUser from "../models/admin_user.model.js";
import AdminSchool from "../models/admin_school.model.js";
import StudentProfile from "../models/student_profile.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import AdminRole from "../models/admin_role.model.js";
import AdminPermission from "../models/admin_permission.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  generateAccessToken,
  generateRefreshToken
} from "../utils/jwt.util.js";

import {
  generateOTP,
  createOtpToken,
  verifyOtpToken
} from "../utils/otp.util.js";

// Send OTP to phone number for login
const sendLoginOtp = asyncHandler(async (req, res) => {
    const { phone_number } = req.body;

    if (!phone_number)
      throw new ApiError(400, "Phone number required");

    const user = await AdminUser.findOne({ where: { phone_number } });
    if (!user) throw new ApiError(404, "User not found");

    const otp = generateOTP();
    const otpToken = createOtpToken(phone_number, otp);

    console.log("OTP (DEV ONLY):", otp);

    return res.status(200).json(
      new ApiResponse(200, { otpToken }, "OTP sent successfully")
    );
});

// Login controller supporting both password and OTP login
const login = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    password,
    phone_number,
    otp,
    otpToken
  } = req.body;

  let user;

  /* PASSWORD LOGIN */
  if ((username || email) && password) {
    user = await AdminUser.findOne({
      where: username ? { username } : { email }
    });

    if (!user) throw new ApiError(404, "User not found");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ApiError(401, "Invalid credentials");
  }

  /* OTP LOGIN */
  else if (phone_number && otp && otpToken) {
    verifyOtpToken(phone_number, otp, otpToken);

    user = await AdminUser.findOne({ where: { phone_number } });
    if (!user) throw new ApiError(404, "User not found");
  }

  else {
    throw new ApiError(400, "Invalid login payload");
  }

  if (user.status !== "active")
    throw new ApiError(403, "User inactive");

  /* LOAD ROLE + PERMISSIONS */
  const userWithRole = await AdminUser.findOne({
    where: { user_id: user.user_id },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: AdminRole,
        as: "role",
        include: [
          {
            model: AdminPermission,
            as: "permissions",
            attributes: ["permission_key"]
          }
        ]
      }
    ]
  });

  if (!userWithRole) throw new ApiError(404, "User not found");

  const permissions =
    userWithRole.role.permissions.map(p => p.permission_key);

  /* TOKEN PAYLOAD */
  const payload = {
    user_id: user.user_id,
    role: userWithRole.role.role_name,
    permissions,
    school_id: user.school_id
  };

  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        role: payload.role,
        permissions,
        school_id: user.school_id,
        profile: userWithRole
      },
      "Login successful"
    )
  );
});


// LOGOUT
const logout = asyncHandler(async (req, res) => {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

// Get profile of logged in user
const getLoggedInUserProfile = asyncHandler(async (req, res) => {
  const { user_id, role, school_id } = req.user;

  let profileData = null;
  let school = null;

  // Admin and Subadmin
  if (["ADMIN", "SUBADMIN"].includes(role)) {
    const user = await AdminUser.findOne({
      where: { user_id },
      attributes: { exclude: ["password"] }
    });

    if (!user) throw new ApiError(404, "User not found");

    if (school_id) {
      school = await AdminSchool.findOne({
        where: { school_id }
      });
    }

    profileData = {
      user,
      school
    };
  }

  // Teacher

  else if (role === "TEACHER") {
    const teacher = await TeacherProfile.findOne({
      where: { user_id }
    });

    if (!teacher) throw new ApiError(404, "Teacher profile not found");

    school = await AdminSchool.findOne({
      where: { school_id: teacher.school_id }
    });

    profileData = {
      teacher,
      school
    };
  }

  // Student
  else if (role === "STUDENT") {
    const student = await StudentProfile.findOne({
      where: { user_id }
    });

    if (!student) throw new ApiError(404, "Student profile not found");

    school = await AdminSchool.findOne({
      where: { school_id: student.school_id }
    });

    profileData = {
      student,
      school
    };
  }

  // Parent
  else if (role === "PARENT") {
    const parent = await ParentProfile.findOne({
      where: { user_id }
    });

    if (!parent)
      throw new ApiError(404, "Parent profile not found");

    // Get all mappings (one parent → many students)
    const mappings = await ParentStudentMap.findAll({
      where: { parent_id: parent.parent_id }
    });

    if (!mappings.length)
      throw new ApiError(404, "Student mapping not found");

    const studentIds = mappings.map(m => m.student_id);

    // Get all students
    const students = await StudentProfile.findAll({
      where: { student_id: studentIds }
    });

    if (!students.length)
      throw new ApiError(404, "Linked students not found");

    // Get school from first student
    school = await AdminSchool.findOne({
      where: { school_id: students[0].school_id }
    });

    profileData = {
      parent,
      students,
      school
    };
  }

  else {
    throw new ApiError(400, "Unsupported role");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      profileData,
      "Profile fetched successfully"
    )
  );
});


export {
  sendLoginOtp,
  login,
  logout,
  getLoggedInUserProfile
};


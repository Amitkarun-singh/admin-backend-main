import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import fs from "fs";
import User from "../models/user.model.js";
import AdminSchool from "../models/admin_school.model.js";
import StudentProfile from "../models/student_profile.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";
import AdminRole from "../models/admin_role.model.js";
import AdminPermission from "../models/admin_permission.model.js";
import ParentStudentMap from "../models/parent_student_map.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSection from "../models/admin_section.model.js";
import { recordSession, closeSession } from "./history.controller.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadAvatarToS3 } from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

import admin from "firebase-admin";
import serviceAccount from "../../schools2ai-firebase-adminsdk.json" with { type: "json" };
import { getAuth } from "firebase-admin/auth";

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function verifyIdToken(idToken) {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);

    console.log(decodedToken.uid);

    return decodedToken;
  } catch (error) {
    console.error("Invalid token:", error);
    throw error;
  }
}


import {
  generateAccessToken,
  generateRefreshToken
} from "../utils/jwt.util.js";

import {
  generateOTP,
  createOtpToken,
  verifyOtpToken
} from "../utils/otp.util.js";

// ─────────────────────────────────────────────
// SEND OTP  (used by login)
// ─────────────────────────────────────────────
const sendLoginOtp = asyncHandler(async (req, res) => {
  const { phone_number } = req.body;

  if (!phone_number)
    throw new ApiError(400, "Phone number required");

  const user = await User.findOne({ where: { phone_number } });
  if (!user) throw new ApiError(404, "User not found");

  const otp      = generateOTP();
  const otpToken = createOtpToken(phone_number, otp);

  console.log("OTP (DEV ONLY):", otp);

  return res.status(200).json(
    new ApiResponse(200, { otpToken }, "OTP sent successfully")
  );
});

// ─────────────────────────────────────────────
// LOGIN  (password OR OTP)
// ─────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { username, email, password, phone_number, idToken } = req.body;

  let user;

  /* ── PASSWORD LOGIN ── */
  if ((username || email) && password) {
    user = await User.findOne({
      where: username ? { username } : { email }
    });

    if (!user) throw new ApiError(404, "User not found");

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ApiError(401, "Invalid credentials");
  }

  /* ── OTP LOGIN ── */
  else if (phone_number && idToken) {
    const decodedToken = await verifyIdToken(idToken);
    if (!decodedToken) throw new ApiError(401, "Invalid credentials");
    const contact_number = phone_number.slice(-10);
    user = await User.findOne({ where: { phone_number: contact_number } });
    if (!user) throw new ApiError(404, "User not found");
  }

  else {
    throw new ApiError(400, "Invalid login payload");
  }

  if (user.status.toLowerCase() !== "active") {
    throw new ApiError(403, "User inactive");
  }

  /* ── FIRST-TIME LOGIN → force password reset ── */
  if (user.is_password_reset_required) {
    const tempToken = jwt.sign(
      { user_id: user.user_id, purpose: "password_reset" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        { requiresPasswordReset: true, tempToken },
        "Password reset required before accessing the application"
      )
    );
  }

  /* ── LOAD ROLE + PERMISSIONS ── */
  const userWithRole = await User.findOne({
    where:      { user_id: user.user_id },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: AdminRole,
        as:    "role",
        include: [
          {
            model:      AdminPermission,
            as:         "permissions",
            attributes: ["permission_key"]
          }
        ]
      }
    ]
  });

  if (!userWithRole) throw new ApiError(404, "User not found");

  const permissions = userWithRole.role.permissions.map(p => p.permission_key);

  const payload = {
    user_id:   user.user_id,
    role:      userWithRole.role.role_name,
    permissions,
    school_id: user.school_id
  };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000
  });

  await recordSession({
    user_id: user.user_id,
    ua:      req.headers["user-agent"],
    ip:      req.ip || req.headers["x-forwarded-for"],
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        role:       payload.role,
        permissions,
        school_id:  user.school_id,
        profile:    userWithRole
      },
      "Login successful"
    )
  );
});

// ─────────────────────────────────────────────
// RESET FIRST-TIME PASSWORD
// POST /auth/reset-first-time-password
// Header: Authorization: Bearer <tempToken>
// Body:   { newPassword, confirmPassword }
// ─────────────────────────────────────────────
const resetFirstTimePassword = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const tempToken  = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!tempToken) throw new ApiError(401, "Temp token required");

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword)
    throw new ApiError(400, "newPassword and confirmPassword are required");

  if (newPassword !== confirmPassword)
    throw new ApiError(400, "Passwords do not match");

  if (newPassword.length < 8)
    throw new ApiError(400, "Password must be at least 8 characters");

  let decoded;
  try {
    decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Temp token is invalid or has expired. Please log in again.");
  }

  if (decoded.purpose !== "password_reset") {
    throw new ApiError(403, "Invalid token purpose");
  }

  const user = await User.findByPk(decoded.user_id);
  if (!user) throw new ApiError(404, "User not found");

  if (!user.is_password_reset_required) {
    throw new ApiError(400, "Password has already been reset. Please log in normally.");
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await user.update({
    password:                   hashed,
    is_password_reset_required: false
  });

  const userWithRole = await User.findOne({
    where:      { user_id: user.user_id },
    attributes: { exclude: ["password"] },
    include: [
      {
        model: AdminRole,
        as:    "role",
        include: [
          {
            model:      AdminPermission,
            as:         "permissions",
            attributes: ["permission_key"]
          }
        ]
      }
    ]
  });

  const permissions = userWithRole.role.permissions.map(p => p.permission_key);

  const payload = {
    user_id:   user.user_id,
    role:      userWithRole.role.role_name,
    permissions,
    school_id: user.school_id
  };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000
  });

  await recordSession({
    user_id: user.user_id,
    ua:      req.headers["user-agent"],
    ip:      req.ip || req.headers["x-forwarded-for"],
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        role:       payload.role,
        permissions,
        school_id:  user.school_id,
        profile:    userWithRole
      },
      "Password reset successful. You are now logged in."
    )
  );
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD — STEP 1
// Send OTP to the registered phone number
// POST /auth/forgot-password/send-otp
// Body: { phone_number }
// ─────────────────────────────────────────────
const forgotPasswordSendOtp = asyncHandler(async (req, res) => {
  const { phone_number } = req.body;

  if (!phone_number)
    throw new ApiError(400, "Phone number is required");

  // Verify the number belongs to a real, active user
  const user = await User.findOne({ where: { phone_number } });
  if (!user)
    throw new ApiError(404, "No account found with this phone number");

  if (user.status.toLowerCase() !== "active")
    throw new ApiError(403, "Account is inactive. Contact your administrator.");

  const otp      = generateOTP();
  const otpToken = createOtpToken(phone_number, otp);

  console.log("Forgot-password OTP (DEV ONLY):", otp);

  return res.status(200).json(
    new ApiResponse(
      200,
      { otpToken },
      "OTP sent successfully. Please verify to reset your password."
    )
  );
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD — STEP 2
// Verify OTP → receive a short-lived resetToken
// POST /auth/forgot-password/verify-otp
// Body: { phone_number, otp, otpToken }
// ─────────────────────────────────────────────
const forgotPasswordVerifyOtp = asyncHandler(async (req, res) => {
  const { phone_number, otp, otpToken } = req.body;

  if (!phone_number || !otp || !otpToken)
    throw new ApiError(400, "phone_number, otp, and otpToken are required");

  // Throws ApiError if OTP is wrong or expired
  verifyOtpToken(phone_number, otp, otpToken);

  const user = await User.findOne({ where: { phone_number } });
  if (!user) throw new ApiError(404, "User not found");

  // Issue a short-lived token dedicated to the password-reset step only
  // purpose:"forgot_password" distinguishes it from the first-login reset token
  const resetToken = jwt.sign(
    { user_id: user.user_id, purpose: "forgot_password" },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "10m" }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      { resetToken },
      "OTP verified. You may now reset your password."
    )
  );
});

// ─────────────────────────────────────────────
// FORGOT PASSWORD — STEP 3
// Set the new password using the resetToken
// POST /auth/forgot-password/reset
// Header: Authorization: Bearer <resetToken>
// Body:   { newPassword, confirmPassword }
// ─────────────────────────────────────────────
const forgotPasswordReset = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  const resetToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!resetToken) throw new ApiError(401, "Reset token required");

  const { newPassword, confirmPassword } = req.body;

  if (!newPassword || !confirmPassword)
    throw new ApiError(400, "newPassword and confirmPassword are required");

  if (newPassword !== confirmPassword)
    throw new ApiError(400, "Passwords do not match");

  if (newPassword.length < 8)
    throw new ApiError(400, "Password must be at least 8 characters");

  // Verify the reset token
  let decoded;
  try {
    decoded = jwt.verify(resetToken, process.env.ACCESS_TOKEN_SECRET);
  } catch {
    throw new ApiError(401, "Reset token is invalid or has expired. Please start over.");
  }

  // Must be a forgot-password token — not a first-login token
  if (decoded.purpose !== "forgot_password") {
    throw new ApiError(403, "Invalid token purpose");
  }

  const user = await User.findByPk(decoded.user_id);
  if (!user) throw new ApiError(404, "User not found");

  const hashed = await bcrypt.hash(newPassword, 10);

  // Save new password and clear first-login flag (in case they had never logged in)
  await user.update({
    password:                   hashed,
    is_password_reset_required: false
  });

  // No tokens issued — user is redirected to login after a successful reset
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password reset successful. Please log in with your new password."
    )
  );
});

// ─────────────────────────────────────────────
// REFRESH ACCESS TOKEN
// ─────────────────────────────────────────────
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookies.refreshToken;
  console.log("Cookies:", req.cookies);

  if (!incomingRefreshToken)
    throw new ApiError(401, "Refresh token missing");

  try {
    const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findOne({ where: { user_id: decoded.user_id } });
    if (!user) throw new ApiError(401, "Invalid refresh token");

    const payload = {
      user_id:     user.user_id,
      role:        decoded.role,
      permissions: decoded.permissions,
      school_id:   decoded.school_id
    };

    const newAccessToken  = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await User.update(
      { refresh_token: newRefreshToken },
      { where: { user_id: user.user_id } }
    );

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge:   7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json(
      new ApiResponse(200, { accessToken: newAccessToken }, "Access token refreshed")
    );
  } catch (error) {
    throw new ApiError(401, "Invalid or expired refresh token");
  }
});

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
const logout = asyncHandler(async (req, res) => {
  await closeSession(req.user.user_id);

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict"
  });

  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

// ─────────────────────────────────────────────
// GET LOGGED-IN USER PROFILE
// ─────────────────────────────────────────────
const getLoggedInUserProfile = asyncHandler(async (req, res) => {
  const { user_id, role, school_id } = req.user;

  let profileData = null;
  let school      = null;

  if (["ADMIN", "SUBADMIN"].includes(role)) {
    const user = await User.findOne({
      where:      { user_id },
      attributes: { exclude: ["password"] }
    });

    if (!user) throw new ApiError(404, "User not found");

    if (school_id) {
      school = await AdminSchool.findOne({ where: { school_id } });
    }

    if (user.avatar !== null) {
      const avatarUrl = await getSignedPdfUrl(user?.avatar);
      profileData = { role, user, school, avatarUrl };
    } else {
      profileData = { role, user, school };
    }
  }

  else if (role === "TEACHER") {
    const teacher = await TeacherProfile.findOne({ where: { user_id } });
    if (!teacher) throw new ApiError(404, "Teacher profile not found");

    // school is null for standalone teachers — no crash
    if (teacher.school_id) {
      school = await AdminSchool.findOne({ where: { school_id: teacher.school_id } });
    }

    profileData = {
      role,
      teacher,
      school,
      is_standalone:    !teacher.school_id,
      profile_complete: !!teacher.primary_subject_id,
    };
  }

  else if (role === "STUDENT") {
    const student = await StudentProfile.findOne({ where: { user_id } });
    if (!student) throw new ApiError(404, "Student profile not found");

    const user = await User.findOne({
      where:      { user_id },
      attributes: ["full_name", "email", "phone_number", "role_id", "avatar"]
    });

    const roleData  = await AdminRole.findOne({ where: { role_id: user.role_id } });
    const avatarUrl = user?.avatar ? await getSignedPdfUrl(user?.avatar) : null;

    // school is null for standalone students — no crash
    if (student.school_id) {
      school = await AdminSchool.findOne({ where: { school_id: student.school_id } });
    }

    // class/section is null for standalone students — no crash
    let classData    = null;
    let sectionData  = null;
    let classSection = null;

    classSection = await StudentClassSection.findOne({
      where: { student_id: student.student_id }
    });

    if (classSection) {
      classData   = await AdminClass.findOne({ where: { class_id: classSection.class_id } });
      sectionData = await AdminSection.findOne({ where: { section_id: classSection.section_id } });
    }

    profileData = {
      school_name:  school?.school_name   ?? null,
      board:        school?.board         ?? null,
      address:      school
        ? `${school.city}, ${school.state}, ${school.country}, ${school.pincode}`
        : null,
      class:        classData?.class_name     ?? null,
      div:          sectionData?.section_name ?? null,
      roll_number:  classSection?.roll_number ?? null,
      Student_name: user?.full_name,
      number:       user?.phone_number,
      email:        user?.email,
      gender:       student?.gender,
      dob:          student?.dob,
      language:     student?.preferred_language,
      joining_date: student?.onboarding_date,
      role:         roleData?.role_name,
      avatar:       avatarUrl,

      // frontend uses these to decide whether to show school/class fields
      is_standalone:    !student.school_id,
      profile_complete: !!student.preferred_language,
    };
  }

  else if (role === "PARENT") {
    const parent = await ParentProfile.findOne({ where: { user_id } });
    if (!parent) throw new ApiError(404, "Parent profile not found");

    const mappings = await ParentStudentMap.findAll({ where: { parent_id: parent.parent_id } });
    if (!mappings.length) throw new ApiError(404, "Student mapping not found");

    const studentIds = mappings.map(m => m.student_id);
    const students   = await StudentProfile.findAll({ where: { student_id: studentIds } });
    if (!students.length) throw new ApiError(404, "Linked students not found");

    school = await AdminSchool.findOne({ where: { school_id: students[0].school_id } });
    profileData = { parent, students, school };
  }

  else {
    throw new ApiError(400, "Unsupported role");
  }

  return res.status(200).json(
    new ApiResponse(200, profileData, "Profile fetched successfully")
  );
});

// ─────────────────────────────────────────────
// UPDATE AVATAR
// ─────────────────────────────────────────────
const updateAvatar = asyncHandler(async (req, res) => {
  const { user_id } = req.user;

  if (!req.file) throw new ApiError(400, "Avatar file is required");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(req.file.mimetype))
    throw new ApiError(400, "Only JPG, PNG, WEBP allowed");

  const { key } = await uploadAvatarToS3(req.file, user_id);

  await User.update({ avatar: key }, { where: { user_id } });

  fs.unlinkSync(req.file.path);

  return res.status(200).json(
    new ApiResponse(200, { avatar: key }, "Avatar updated successfully")
  );
});

export {
  sendLoginOtp,
  login,
  resetFirstTimePassword,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  refreshAccessToken,
  logout,
  getLoggedInUserProfile,
  updateAvatar
};
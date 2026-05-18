import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import authService from "../services/auth.service.js";
import userRepository from "../repositories/user.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import classRepository from "../repositories/class.repository.js";
import { recordSession, closeSession } from "./history.controller.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";
import { generateOTP, createOtpToken, verifyOtpToken } from "../utils/otp.util.js";
import { uploadAvatarToS3 } from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";
import UserStreak from "../models/user_streak.model.js";
import sequelize from "../config/db.js";

interface AuthenticatedRequest extends Request {
  user: any;
}

// /* ─────────────────────────────────────────────────────────────
//    HELPER: get streak info for any user
//    Returns zeros safely if the row doesn't exist yet
// ───────────────────────────────────────────────────────────── */
// async function getStreakData(user_id: number) {
//   try {
//     const row: any = await UserStreak.findOne({ where: { user_id } });
//     return {
//       current_streak: row?.current_streak ?? 0,
//       longest_streak: row?.longest_streak ?? 0,
//       last_active_date: row?.last_active_date ?? null,
//     };
//   } catch {
//     return { current_streak: 0, longest_streak: 0, last_active_date: null };
//   }
// }

// /* ─────────────────────────────────────────────────────────────
//    HELPER: get overall practice score (0-100) for a student
// ───────────────────────────────────────────────────────────── */
// async function getOverallScore(student_id: number): Promise<number> {
//   try {
//     const [row]: any = await sequelize.query(
//       `SELECT ROUND(AVG(pq.is_correct) * 100) AS overallScore
//        FROM   practice_tests pt
//        JOIN   practice_questions pq ON pt.id = pq.test_id
//        WHERE  pt.student_id = :student_id`,
//       { replacements: { student_id }, type: (sequelize as any).QueryTypes.SELECT }
//     );
//     return Number(row?.overallScore ?? 0);
//   } catch {
//     return 0;
//   }
// }

/* ─────────────────────────────────────────────────────────────
   HELPER: sign avatar S3 key → URL (null if no avatar yet)
───────────────────────────────────────────────────────────── */
async function signAvatar(key: string | null | undefined, role: string): Promise<string | null> {
  console.log(`[AVATAR][${role}] raw key from DB:`, key ?? "null — no avatar uploaded yet");
  if (!key) return null;
  try {
    const url = await getSignedPdfUrl(key);
    console.log(`[AVATAR][${role}] signed URL:`, url ? url.slice(0, 80) + "…" : "null");
    return url ?? null;
  } catch (err: any) {
    console.error(`[AVATAR][${role}] signing failed:`, err.message);
    return null;
  }
}

/* =====================================================
   LOGIN
   ===================================================== */
const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  if (result.requiresPasswordReset) {
    return res.status(200).json(new ApiResponse(200, result, "Password reset required"));
  }

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await recordSession({
    user_id: result.profile.user_id,
    ua: req.headers["user-agent"],
    ip: req.ip || req.headers["x-forwarded-for"],
  });

  return res.status(200).json(new ApiResponse(200, result, "Login successful"));
});

/* =====================================================
   RESET FIRST-TIME PASSWORD
   ===================================================== */
const resetFirstTimePassword = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tempToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!tempToken) throw new ApiError(401, "Temp token required");

  const { newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) throw new ApiError(400, "Passwords do not match");

  let decoded: any;
  try { decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET!); }
  catch { throw new ApiError(401, "Invalid token"); }
  if (decoded.purpose !== "password_reset") throw new ApiError(403, "Invalid purpose");

  const result = await authService.resetFirstTimePassword(decoded.user_id, newPassword);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await recordSession({
    user_id: result.profile.user_id,
    ua: req.headers["user-agent"],
    ip: req.ip || req.headers["x-forwarded-for"],
  });

  return res.status(200).json(new ApiResponse(200, result, "Password reset successful"));
});

/* =====================================================
   LOGOUT
   ===================================================== */
const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await closeSession(req.user.user_id);
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

/* =====================================================
   REFRESH ACCESS TOKEN
   ===================================================== */
const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies.refreshToken;
  if (!incomingRefreshToken) throw new ApiError(401, "Refresh token missing");

  try {
    const decoded: any = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET!);
    const user = await userRepository.findById(decoded.user_id);
    if (!user) throw new ApiError(401, "Invalid token");

    const payload = {
      user_id: (user as any).user_id,
      role: decoded.role,
      permissions: decoded.permissions,
      school_id: decoded.school_id,
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed"));
  } catch {
    throw new ApiError(401, "Invalid refresh token");
  }
});

/* =====================================================
   GET LOGGED-IN USER PROFILE
   ✅ Now returns for all roles:
      avatar, current_streak, longest_streak, last_active_date
   ✅ STUDENT also gets:
      overall_score
   ===================================================== */
// const getLoggedInUserProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
//   const { user_id, role, school_id } = req.user;
//   let profileData: any = null;

//   /* ── ADMIN / SUBADMIN ── */
//   if (["ADMIN", "SUBADMIN"].includes(role)) {
//     const [user, school, streak] = await Promise.all([
//       userRepository.findById(user_id),
//       school_id ? schoolRepository.findById(school_id) : Promise.resolve(null),
//       getStreakData(user_id),
//     ]);

//     const avatarUrl = await signAvatar((user as any)?.avatar, role);

//     profileData = {
//       avatar: avatarUrl,
//       role,
//       user,
//       school,
//       current_streak: streak.current_streak,
//       longest_streak: streak.longest_streak,
//       last_active_date: streak.last_active_date,
//     };

//     /* ── TEACHER ── */
//   } else if (role === "TEACHER") {
//     const [teacher, user, streak]: any[] = await Promise.all([
//       profileRepository.findTeacherByUserId(user_id),
//       userRepository.findWithRoleAndPermissions(user_id),
//       getStreakData(user_id),
//     ]);

//     const school = teacher?.school_id ? await schoolRepository.findById(teacher.school_id) : null;
//     const teacherClasses = teacher ? await profileRepository.findTeacherClassSections(teacher.teacher_id) : [];
//     const classSection = (teacherClasses as any[])[0] ?? null;
//     const teacherClass = classSection?.class_id ? await classRepository.findById(classSection.class_id) : null;
//     const teacherSection = classSection?.section_id ? await classRepository.findSectionById(classSection.section_id) : null;

//     const avatarUrl = await signAvatar((user as any)?.avatar, role);

//     profileData = {
//       avatar: avatarUrl,
//       gender: (teacher as any)?.gender?.toLowerCase() || null,
//       dob: (teacher as any)?.dob || null,
//       full_name: user?.full_name,
//       number: user?.phone_number,
//       email: user?.email,
//       language: (teacher as any)?.preferred_language || null,
//       role,
//       school_name: (school as any)?.school_name,
//       board_name: (school as any)?.board,
//       class_name: (teacherClass as any)?.class_name,
//       section_name: (teacherSection as any)?.section_name,
//       current_streak: (streak as any).current_streak,
//       longest_streak: (streak as any).longest_streak,
//       last_active_date: (streak as any).last_active_date,
//     };

//     /* ── STUDENT ── */
//   } else if (role === "STUDENT") {
//     // Run independent fetches in parallel
//     const [student, user, streak]: any[] = await Promise.all([
//       profileRepository.findStudentByUserId(user_id),
//       userRepository.findWithRoleAndPermissions(user_id),
//       getStreakData(user_id),
//     ]);

//     // These need student first
//     const [school, classSection, overall_score] = await Promise.all([
//       student?.school_id ? schoolRepository.findById(student.school_id) : Promise.resolve(null),
//       student ? profileRepository.findStudentClassSection(student.student_id) : Promise.resolve(null),
//       getOverallScore(user_id),
//     ]);

//     const [studentClass, studentSection] = await Promise.all([
//       (classSection as any)?.class_id ? classRepository.findById((classSection as any).class_id) : Promise.resolve(null),
//       (classSection as any)?.section_id ? classRepository.findSectionById((classSection as any).section_id) : Promise.resolve(null),
//     ]);

//     const avatarUrl = await signAvatar((user as any)?.avatar, role);

//     profileData = {
//       avatar: avatarUrl,           // signed S3 URL, null if none uploaded
//       gender: student?.gender?.toLowerCase() || null,
//       dob: student?.dob,
//       full_name: user?.full_name,
//       number: user?.phone_number,
//       email: user?.email,
//       language: student?.preferred_language,
//       role,
//       school_name: (school as any)?.school_name,
//       board_name: (school as any)?.board,
//       class_id: (classSection as any)?.class_id,
//       section_id: (classSection as any)?.section_id,
//       class_name: (studentClass as any)?.class_name,
//       section_name: (studentSection as any)?.section_name,
//       // ── new fields ──────────────────────────────────
//       current_streak: (streak as any).current_streak,    // e.g. 3
//       longest_streak: (streak as any).longest_streak,    // e.g. 7
//       last_active_date: (streak as any).last_active_date,  // e.g. "2026-05-15"
//       overall_score,                                        // e.g. 12  (0-100)
//     };
//   }

//   return res.status(200).json(new ApiResponse(200, profileData, "Profile fetched"));
// });

export {
  login,
  resetFirstTimePassword,
  logout,
  refreshAccessToken,
  //getLoggedInUserProfile,
  // sendLoginOtp,
  verifyIdToken,
  //forgotPasswordReset,
  updateAvatar,
  resetPassword,
};

// async function sendLoginOtp(req: Request, res: Response) {
//   const { phone_number } = req.body;
//   const result = await authService.sendLoginOtp(phone_number);
//   console.log("OTP (DEV ONLY):", result.otp);
//   return res.status(200).json(new ApiResponse(200, { otpToken: result.otpToken }, "OTP sent"));
// }

async function verifyIdToken(req: Request, res: Response) {
  const { idToken } = req.body;
  const result = await authService.verifyIdToken(idToken);

  return res.status(200).json(new ApiResponse(200, { idToken: result.idToken }, "user verified"));
}

async function resetPassword(req: Request, res: Response) {
  const { phoneNumber, newPassword, confirmPassword, idToken } = req.body;
  if (newPassword !== confirmPassword) throw new ApiError(400, "Passwords do not match");
  const phone_number = phoneNumber.trim().slice(-10);
  const result = await authService.resetPassword(phone_number, newPassword, confirmPassword, idToken);
  return res.status(200).json(new ApiResponse(200, result, "OTP verified"));
}

// async function forgotPasswordReset(req: Request, res: Response) {
//   const authHeader = req.headers.authorization;
//   const resetToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
//   if (!resetToken) throw new ApiError(401, "Reset token required");

//   const { newPassword, confirmPassword } = req.body;
//   if (newPassword !== confirmPassword) throw new ApiError(400, "Passwords do not match");

//   let decoded: any;
//   try { decoded = jwt.verify(resetToken, process.env.ACCESS_TOKEN_SECRET!); }
//   catch { throw new ApiError(401, "Invalid token"); }
//   if (decoded.purpose !== "forgot_password") throw new ApiError(403, "Invalid purpose");

//   await authService.forgotPasswordReset(decoded.user_id, newPassword);
//   return res.status(200).json(new ApiResponse(200, {}, "Password reset successful"));
// }

async function updateAvatar(req: AuthenticatedRequest, res: Response) {
  const { user_id } = req.user;
  if (!req.file) throw new ApiError(400, "File required");

  const { key } = await uploadAvatarToS3(req.file as any, user_id);
  await userRepository.update(user_id, { avatar: key });

  if (req.file.path) fs.unlinkSync(req.file.path);
  return res.status(200).json(new ApiResponse(200, { avatar: key }, "Avatar updated"));
}
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
import { recordSession, closeSession } from "./history.controller.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";
import { generateOTP, createOtpToken, verifyOtpToken } from "../utils/otp.util.js";
import { uploadAvatarToS3 } from "../utils/s3Upload.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

// types for req.user (since it's added by authMiddleware)
interface AuthenticatedRequest extends Request {
  user: any;
}

const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);

  if (result.requiresPasswordReset) {
    return res.status(200).json(
      new ApiResponse(200, result, "Password reset required")
    );
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

  return res.status(200).json(
    new ApiResponse(200, result, "Login successful")
  );
});

const resetFirstTimePassword = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tempToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!tempToken) throw new ApiError(401, "Temp token required");

  const { newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) throw new ApiError(400, "Passwords do not match");

  let decoded: any;
  try {
    decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET!);
  } catch {
    throw new ApiError(401, "Invalid token");
  }

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

  return res.status(200).json(
    new ApiResponse(200, result, "Password reset successful")
  );
});

const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await closeSession(req.user.user_id);
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict"
  });
  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

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
      school_id: decoded.school_id
    };

    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.status(200).json(
      new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed")
    );
  } catch (error) {
    throw new ApiError(401, "Invalid refresh token");
  }
});

const getLoggedInUserProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user_id, role, school_id } = req.user;
  let profileData: any = null;

  if (["ADMIN", "SUBADMIN"].includes(role)) {
    const user = await userRepository.findById(user_id);
    const school = school_id ? await schoolRepository.findById(school_id) : null;
    profileData = { role, user, school };
  } else if (role === "TEACHER") {
    const teacher: any = await profileRepository.findTeacherByUserId(user_id);
    const school = teacher?.school_id ? await schoolRepository.findById(teacher.school_id) : null;
    profileData = { role, teacher, school };
  } else if (role === "STUDENT") {
    const student: any = await profileRepository.findStudentByUserId(user_id);
    const user: any = await userRepository.findWithRoleAndPermissions(user_id);
    const school = student?.school_id ? await schoolRepository.findById(student.school_id) : null;
    
    profileData = {
      full_name: user?.full_name,
      number: user?.phone_number,
      email: user?.email,
      gender: student?.gender,
      dob: student?.dob,
      language: student?.preferred_language,
      role: role,
      school_name: (school as any)?.school_name,
    };
  }
console.log("profile data fetched")
  return res.status(200).json(new ApiResponse(200, profileData, "Profile fetched"));
});

export {
  login,
  resetFirstTimePassword,
  logout,
  refreshAccessToken,
  getLoggedInUserProfile,
  sendLoginOtp,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  updateAvatar
};

async function sendLoginOtp(req: Request, res: Response) {
  const { phone_number } = req.body;
  const result = await authService.sendLoginOtp(phone_number);
  console.log("OTP (DEV ONLY):", result.otp);
  return res.status(200).json(new ApiResponse(200, { otpToken: result.otpToken }, "OTP sent"));
}

async function forgotPasswordSendOtp(req: Request, res: Response) {
  const { phone_number } = req.body;
  const result = await authService.forgotPasswordSendOtp(phone_number);
  console.log("Forgot-password OTP (DEV ONLY):", result.otp);
  return res.status(200).json(new ApiResponse(200, { otpToken: result.otpToken }, "OTP sent"));
}

async function forgotPasswordVerifyOtp(req: Request, res: Response) {
  const { phone_number, otp, otpToken } = req.body;
  const result = await authService.forgotPasswordVerifyOtp(phone_number, otp, otpToken);
  return res.status(200).json(new ApiResponse(200, result, "OTP verified"));
}

async function forgotPasswordReset(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  const resetToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!resetToken) throw new ApiError(401, "Reset token required");

  const { newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) throw new ApiError(400, "Passwords do not match");

  let decoded: any;
  try {
    decoded = jwt.verify(resetToken, process.env.ACCESS_TOKEN_SECRET!);
  } catch {
    throw new ApiError(401, "Invalid token");
  }

  if (decoded.purpose !== "forgot_password") throw new ApiError(403, "Invalid purpose");

  await authService.forgotPasswordReset(decoded.user_id, newPassword);
  return res.status(200).json(new ApiResponse(200, {}, "Password reset successful"));
}

async function updateAvatar(req: AuthenticatedRequest, res: Response) {
  const { user_id } = req.user;
  if (!req.file) throw new ApiError(400, "File required");

  const { key } = await uploadAvatarToS3(req.file as any, user_id);
  await userRepository.update(user_id, { avatar: key });

  if (req.file.path) fs.unlinkSync(req.file.path);
  return res.status(200).json(new ApiResponse(200, { avatar: key }, "Avatar updated"));
}

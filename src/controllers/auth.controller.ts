  import { Request, Response } from "express";
  import jwt from "jsonwebtoken";
  import fs from "fs";
  import { asyncHandler } from "../utils/asyncHandler.js";

  import { ApiResponse } from "../utils/ApiResponse.js";
  import authService from "../services/auth.service.js";
  import userRepository from "../repositories/user.repository.js";

  import { recordSession, closeSession } from "./history.controller.js";
  import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";

import { ValidationError } from "../error/subError.ts";

interface AuthenticatedRequest extends Request {
  user: any;
}

/* =====================================================
   LOGIN
   ===================================================== */
const login = asyncHandler(async (req: Request, res: Response) => {
  const result: any = await authService.login(req.body);

  if (result.requiresPasswordReset) {
    return res.status(200).json(new ApiResponse(200, result, "Password reset required"));
  }



  /* =====================================================
    LOGIN
    ===================================================== */
  const login = asyncHandler(async (req: Request, res: Response) => {
    const result: any = await authService.login(req.body);

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
    if (!tempToken) throw new ValidationError([{
      field: "authorization",
      message: "Temporary token required",
      code: "TOKEN_REQUIRED"
    }]);

async function verifyIdToken(req: Request, res: Response) {
  const { idToken } = req.body;
  const result = await authService.verifyIdToken(idToken);

  return res.status(200).json(new ApiResponse(200, { idToken: result.idToken }, "user verified"));
}

async function resetPassword(req: Request, res: Response) {
  const { phoneNumber, newPassword, confirmPassword, idToken } = req.body;
  if (newPassword !== confirmPassword) {
    throw new ValidationError([{
      field: "confirmPassword",
      message: "Passwords do not match",
      code: "PASSWORD_MISMATCH"
    }]);

    let decoded: any;
    try { decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET!); }
    catch { throw new ValidationError([{
      field: "authorization",
      message: "Invalid token",
      code: "INVALID_TOKEN"
    }]); }
    if (decoded.purpose !== "password_reset") throw new ValidationError([{
      field: "purpose",
      message: "Invalid purpose",
      code: "INVALID_PURPOSE"
    }]);

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
    if (!incomingRefreshToken) throw new ValidationError([{
      field: "refreshToken",
      message: "Refresh token missing",
      code: "TOKEN_REQUIRED"
    }]);

    try {
      const decoded: any = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET!);
      const user = await userRepository.findById(decoded.user_id);
      if (!user) throw new ValidationError([{
        field: "refreshToken",
        message: "Invalid token",
        code: "INVALID_TOKEN"
      }]);

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
      throw new ValidationError([{
        field: "refreshToken",
        message: "Invalid refresh token",
        code: "INVALID_TOKEN"
      }]);
    }
  });






  async function verifyIdToken(req: Request, res: Response) {
    const { idToken } = req.body;
    const result = await authService.verifyIdToken(idToken);

    return res.status(200).json(new ApiResponse(200, { idToken: result.idToken }, "user verified"));
  }

  async function resetPassword(req: Request, res: Response) {
    const { phoneNumber, newPassword, confirmPassword, idToken } = req.body;
    if (newPassword !== confirmPassword) {
      throw new ValidationError([{
        field: "confirmPassword",
        message: "Passwords do not match",
        code: "PASSWORD_MISMATCH"
      }]);
    }
    const phone_number = phoneNumber.trim().slice(-10);
    const result = await authService.resetPassword(phone_number, newPassword, confirmPassword, idToken);
    return res.status(200).json(new ApiResponse(200, result, "OTP verified"));
  }



export {
  login,
  resetFirstTimePassword,
  logout,
  refreshAccessToken,
  verifyIdToken,
  resetPassword,
};

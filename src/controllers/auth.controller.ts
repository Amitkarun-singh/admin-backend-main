import { Request, Response } from "express";
import jwt from "jsonwebtoken";
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

// ── Shared helper: set refresh-token cookie + record session ─────────────────
async function finaliseLogin(res: Response, req: Request, result: any) {
  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  await recordSession({
    user_id: result.profile.user_id,
    ua: req.headers["user-agent"],
    ip:
      req.ip ||
      (Array.isArray(req.headers["x-forwarded-for"])
        ? req.headers["x-forwarded-for"][0]
        : req.headers["x-forwarded-for"]),
  });
}

/* =====================================================
   LOGIN
   ===================================================== */
const login = asyncHandler(async (req: Request, res: Response) => {
  const result: any = await authService.login(req.body);

  if (result.requiresAccountSelection) {
    return res.status(200).json(
      new ApiResponse(200, result, "Multiple accounts found. Please select an account.")
    );
  }

  if (result.requiresPasswordReset) {
    return res.status(200).json(
      new ApiResponse(200, result, "Password reset required")
    );
  }

  await finaliseLogin(res, req, result);
  return res.status(200).json(new ApiResponse(200, result, "Login successful"));
});

/* =====================================================
   SELECT ACCOUNT  (phone multi-account picker — at login time)
   POST /auth/select-account
   Body: { user_id: number }
   ===================================================== */
const selectAccount = asyncHandler(async (req: Request, res: Response) => {
  const { user_id } = req.body;

  if (!user_id) {
    throw new ValidationError([{
      field: "user_id",
      message: "user_id is required",
      code: "MISSING_FIELD",
    }]);
  }

  const result: any = await authService.loginWithSelectedAccount(user_id);

  if (result.requiresPasswordReset) {
    return res.status(200).json(
      new ApiResponse(200, result, "Password reset required")
    );
  }

  await finaliseLogin(res, req, result);
  return res.status(200).json(new ApiResponse(200, result, "Login successful"));
});

/* =====================================================
   GET LINKED ACCOUNTS  (account switcher — after login)
   GET /auth/accounts
   Auth: Bearer <accessToken>
   ===================================================== */
const getLinkedAccounts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const accounts = await authService.getLinkedAccounts(req.user.user_id);
  return res.status(200).json(
    new ApiResponse(200, { accounts }, "Linked accounts fetched")
  );
});

/* =====================================================
   SWITCH ACCOUNT  (no re-auth — same phone number)
   POST /auth/switch-account
   Body: { user_id: number }
   Auth: Bearer <accessToken>
   ===================================================== */
const switchAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { user_id: target_user_id } = req.body;

  if (!target_user_id) {
    throw new ValidationError([{
      field: "user_id",
      message: "user_id is required",
      code: "MISSING_FIELD",
    }]);
  }

  const result: any = await authService.switchAccount(req.user.user_id, target_user_id);

  // Switched-to account may still need a first-time password reset
  if (result.requiresPasswordReset) {
    return res.status(200).json(
      new ApiResponse(200, result, "Password reset required for this account")
    );
  }

  await finaliseLogin(res, req, result);
  return res.status(200).json(
    new ApiResponse(200, result, "Account switched successfully")
  );
});

/* =====================================================
   RESET FIRST-TIME PASSWORD
   ===================================================== */
const resetFirstTimePassword = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const tempToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!tempToken) {
    throw new ValidationError([{
      field: "authorization",
      message: "Temporary token required",
      code: "TOKEN_REQUIRED",
    }]);
  }

  const { newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new ValidationError([{
      field: "confirmPassword",
      message: "Passwords do not match",
      code: "PASSWORD_MISMATCH",
    }]);
  }

  let decoded: any;
  try {
    decoded = jwt.verify(tempToken, process.env.ACCESS_TOKEN_SECRET!);
  } catch {
    throw new ValidationError([{
      field: "authorization",
      message: "Invalid token",
      code: "INVALID_TOKEN",
    }]);
  }

  if (decoded.purpose !== "password_reset") {
    throw new ValidationError([{
      field: "purpose",
      message: "Invalid purpose",
      code: "INVALID_PURPOSE",
    }]);
  }

  const result = await authService.resetFirstTimePassword(decoded.user_id, newPassword);

  await finaliseLogin(res, req, result);
  return res.status(200).json(new ApiResponse(200, result, "Password reset successful"));
});

/* =====================================================
   VERIFY ID TOKEN
   ===================================================== */
const verifyIdToken = asyncHandler(async (req: Request, res: Response) => {
  const { idToken } = req.body;
  const result = await authService.verifyIdToken(idToken);
  return res.status(200).json(new ApiResponse(200, { idToken: result.uid }, "User verified"));
});

/* =====================================================
   RESET PASSWORD (FORGOT / OTP FLOW)
   ===================================================== */
const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { phoneNumber, newPassword, confirmPassword, idToken } = req.body;

  if (newPassword !== confirmPassword) {
    throw new ValidationError([{
      field: "confirmPassword",
      message: "Passwords do not match",
      code: "PASSWORD_MISMATCH",
    }]);
  }

  const phone_number = phoneNumber.trim().slice(-10);
  const result = await authService.resetPassword(
    phone_number, newPassword, confirmPassword, idToken
  );
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
  if (!incomingRefreshToken) {
    throw new ValidationError([{
      field: "refreshToken",
      message: "Refresh token missing",
      code: "TOKEN_REQUIRED",
    }]);
  }

  try {
    const decoded: any = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET!);
    const user = await userRepository.findById(decoded.user_id);
    if (!user) {
      throw new ValidationError([{
        field: "refreshToken",
        message: "Invalid token",
        code: "INVALID_TOKEN",
      }]);
    }

    const payload = {
      user_id:     (user as any).user_id,
      role:        decoded.role,
      permissions: decoded.permissions,
      school_id:   decoded.school_id,
    };

    const newAccessToken  = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json(
      new ApiResponse(200, { accessToken: newAccessToken }, "Token refreshed")
    );
  } catch {
    throw new ValidationError([{
      field: "refreshToken",
      message: "Invalid refresh token",
      code: "INVALID_TOKEN",
    }]);
  }
});

export {
  login,
  selectAccount,
  getLinkedAccounts,
  switchAccount,
  resetFirstTimePassword,
  logout,
  refreshAccessToken,
  verifyIdToken,
  resetPassword,
};
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import { ApiError } from "../utils/ApiError.js";
import userRepository from "../repositories/user.repository.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";
import { recordSession } from "../controllers/history.controller.js";
import { generateOTP, createOtpToken, verifyOtpToken } from "../utils/otp.util.js";
import { ValidationError } from "../error/subError.ts";
import firebaseApp from "../configs/firebase/firebaseConfig.ts";

export class AuthService {
  //validate firebase token
  async verifyIdToken(idToken: string) {
    try {
      const decodedToken = await getAuth(firebaseApp).verifyIdToken(idToken);
      return decodedToken;
    } catch (error) {
      console.error("Invalid token:", error);
      throw new ValidationError([{
        field: "idToken",
        message: "Invalid Firebase token",
        code: "INVALID_TOKEN",
      }]);
    }
  }

  async login(loginData: {
    username?: string;
    email?: string;
    password?: string;
    phone_number?: string;
    idToken?: string;
  }) {
    const { username, email, password, phone_number, idToken } = loginData;
    let user: any;

    if ((username || email) && password) {
      user = username 
        ? await userRepository.findByUsername(username)
        : await userRepository.findByEmail(email!);

      if (!user) throw new ApiError(404, "User not found");

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new ApiError(401, "Invalid credentials");
    } else if (phone_number && idToken) {
      const decodedToken = await this.verifyIdToken(idToken);
      if (!decodedToken) throw new ApiError(401, "Invalid credentials");

      const contact_number = phone_number.trim().slice(-10);
      user = await userRepository.findByPhoneNumber(contact_number);
      if (!user) throw new ApiError(404, "User not found");
    } else {
      throw new ApiError(400, "Invalid login payload");
    }

    const userData = user as any;

    if (userData.status.toLowerCase() !== "active") {
      throw new ApiError(403, "User inactive");
    }

    if (userData.is_password_reset_required) {
      const tempToken = jwt.sign(
        { user_id: userData.user_id, purpose: "password_reset" },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: "15m" }
      );
      return { requiresPasswordReset: true, tempToken };
    }

    const userWithRole: any = await userRepository.findWithRoleAndPermissions(userData.user_id);
    if (!userWithRole) throw new ApiError(404, "User not found");

    const permissions = userWithRole.role.permissions.map((p: any) => p.permission_key);

    const payload = {
      user_id: userData.user_id,
      role: userWithRole.role.role_name,
      permissions,
      school_id: userData.school_id,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      role: payload.role,
      permissions,
      school_id: userData.school_id,
      profile: userWithRole,
    };
  }

  async sendLoginOtp(phone_number: string) {
    const user = await userRepository.findByPhoneNumber(phone_number);
    if (!user) throw new ApiError(404, "User not found");

    const otp = generateOTP();
    const otpToken = createOtpToken(phone_number, otp);
    return { otpToken, otp }; // Return otp for dev logging
  }

  async forgotPasswordSendOtp(phone_number: string) {
    const user = await userRepository.findByPhoneNumber(phone_number);
    if (!user) throw new ApiError(404, "No account found");
    if (user.status.toLowerCase() !== "active") throw new ApiError(403, "Account inactive");

    const otp = generateOTP();
    const otpToken = createOtpToken(phone_number, otp);
    return { otpToken, otp };
  }

  async forgotPasswordVerifyOtp(phone_number: string, otp: string, otpToken: string) {
    verifyOtpToken(phone_number, otp, otpToken);
    const user = await userRepository.findByPhoneNumber(phone_number);
    if (!user) throw new ApiError(404, "User not found");

    const resetToken = jwt.sign(
      { user_id: user.user_id, purpose: "forgot_password" },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: "10m" }
    );
    return { resetToken };
  }

  async forgotPasswordReset(user_id: number | string, newPassword: string) {
    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user_id, {
      password: hashed,
      is_password_reset_required: false,
    });
  }

  async resetFirstTimePassword(user_id: number | string, newPassword: string) {
    const user = await userRepository.findById(user_id);
    if (!user) throw new ApiError(404, "User not found");

    const userData = user as any;

    if (!userData.is_password_reset_required) {
      throw new ApiError(400, "Password already reset");
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user_id, {
      password: hashed,
      is_password_reset_required: false,
    });

    return await this.loginWithUserId(user_id);
  }

  async loginWithUserId(user_id: number | string) {
    const userWithRole: any = await userRepository.findWithRoleAndPermissions(user_id);
    if (!userWithRole) throw new ApiError(404, "User not found");

    const permissions = userWithRole.role.permissions.map((p: any) => p.permission_key);

    const payload = {
      user_id: userWithRole.user_id,
      role: userWithRole.role.role_name,
      permissions,
      school_id: userWithRole.school_id,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      role: payload.role,
      permissions,
      school_id: userWithRole.school_id,
      profile: userWithRole,
    };
  }
}

export default new AuthService();

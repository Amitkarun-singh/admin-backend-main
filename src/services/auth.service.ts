import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import { ApiError } from "../utils/ApiError.js";
import userRepository from "../repositories/user.repository.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";

import { NotFoundError, ValidationError } from "../error/subError.ts";
import firebaseApp from "../configs/firebase/firebaseConfig.ts";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

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



  async verifyCredentials(loginData: {
    username?: string;
    email?: string;
    password?: string;
    phone_number?: string;
    idToken?: string;
  }) {
    const { username, email, password, phone_number, idToken } = loginData;

    if ((username || email) && password) {
      const user = username
        ? await userRepository.findByUsername(username)
        : await userRepository.findByEmail(email!);

      if (!user) throw new NotFoundError("User", username ?? email ?? "unknown");

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new ValidationError([{
        field: "password",
        message: "Invalid password",
        code: "INVALID_PASSWORD",
      }]);

      return user;
    }

    if (phone_number && idToken) {
      const decodedToken = await this.verifyIdToken(idToken);
      if (!decodedToken) throw new ValidationError([{
        field: "idToken",
        message: "Invalid Firebase token",
        code: "INVALID_TOKEN",
      }]);

      const contact_number = phone_number.trim().slice(-10);
      const user = await userRepository.findByPhoneNumber(contact_number);
      if (!user) throw new NotFoundError("User", phone_number);

      return user;
    }

    throw new ValidationError([{
      field: "loginData",
      message: "Invalid login payload",
      code: "INVALID_PAYLOAD",
    }]);
  }

  async login(loginData: {
    username?: string;
    email?: string;
    password?: string;
    phone_number?: string;
    idToken?: string;
  }) {
    const user = await this.verifyCredentials(loginData);
    const userData = user as any;

    if (userData.status.toLowerCase() !== "active") {
      throw new ValidationError([{
        field: "status",
        message: "User inactive",
        code: "USER_INACTIVE",
      }]);
    }

    if (userData.is_password_reset_required) {
      const tempToken = jwt.sign(
        { user_id: userData.user_id, purpose: "password_reset" },
        process.env.ACCESS_TOKEN_SECRET!,
        { expiresIn: "15m" }
      );
      return { requiresPasswordReset: true, tempToken };
    }

    return this.loginWithUserId(userData.user_id);
  }

  

  async resetFirstTimePassword(user_id: number | string, newPassword: string) {
    const user = await userRepository.findById(user_id);
    if (!user) throw new ApiError(404, "User not found");

    const userData = user as any;

    if (!userData.is_password_reset_required) {
      throw new ValidationError([{
        field: "password",
        message: "Password already reset",
        code: "PASSWORD_ALREADY_RESET",
      }]);
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(user_id, {
      password: hashed,
      is_password_reset_required: false,
    });

    return await this.loginWithUserId(user_id);
  }

  async resetPassword(phone_number: string, newPassword: string, confirmPassword: string, idToken: string) {
    try {
      await this.verifyIdToken(idToken);
    } catch (error: any) {
      throw new ValidationError(error);
    }

    const user = await userRepository.findByPhoneNumber(phone_number);


    if (!user) throw new NotFoundError("User", phone_number);

    const userData = user as any;


    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userData.user_id, {
      password: hashed,
    });

    return //await this.loginWithUserId(userData.user_id);
  }

  async loginWithUserId(user_id: number | string) {
    const userWithRole: any = await userRepository.findWithRoleAndPermissions(user_id);
    if (!userWithRole) throw new NotFoundError("User with role and permissions", String(user_id));

    const permissions = userWithRole.role.permissions.map((p: any) => p.permission_key);

    // Sign avatar if present
    if (userWithRole.avatar) {
      userWithRole.avatar = await this.signAvatar(userWithRole.avatar, userWithRole.role.role_name);
    }

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

  async signAvatar(key: string | null | undefined, role: string): Promise<string | null> {
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


}

export default new AuthService();

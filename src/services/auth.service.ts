import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getAuth } from "firebase-admin/auth";
import { ApiError } from "../utils/ApiError.js";
import userRepository from "../repositories/user.repository.js";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt.util.js";

import { NotFoundError, ValidationError } from "../error/subError.ts";
import firebaseApp from "../configs/firebase/firebaseConfig.ts";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

// ─── Discriminated union returned by verifyCredentials ───────────────────────
type CredentialResult =
  | { type: "single"; user: any }
  | { type: "multiple"; accounts: any[] };

// ─── Shape returned to the frontend when multiple accounts exist ──────────────
export interface AccountOption {
  user_id: number;
  full_name: string;
  role: string;
  school_id: number | null;
  status: string;
  avatar: string | null;
}

export class AuthService {
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
  }): Promise<CredentialResult> {
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

      return { type: "single", user };
    }

    if (phone_number && idToken) {
      await this.verifyIdToken(idToken);

      const contact_number = phone_number.trim().slice(-10);
      const users = await userRepository.findAllByPhoneNumber(contact_number);

      if (!users || users.length === 0)
        throw new NotFoundError("User", phone_number);

      if (users.length > 1)
        return { type: "multiple", accounts: users };

      return { type: "single", user: users[0] };
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
    const result = await this.verifyCredentials(loginData);

    if (result.type === "multiple") {
      const accounts: AccountOption[] = result.accounts.map((u: any) => ({
        user_id: u.user_id,
        full_name: u.full_name,
        role: u.role?.role_name ?? "Unknown",
        school_id: u.school_id ?? null,
        status: u.status,
        avatar: u.avatar ?? null,
      }));

      return { requiresAccountSelection: true, accounts };
    }

    return this._proceedWithUser(result.user);
  }

  async loginWithSelectedAccount(user_id: number | string) {
    const user = await userRepository.findById(user_id);
    if (!user) throw new NotFoundError("User", String(user_id));
    return this._proceedWithUser(user);
  }

  async switchAccount(current_user_id: number | string, target_user_id: number | string) {
    const currentUser = await userRepository.findById(current_user_id);
    const targetUser  = await userRepository.findById(target_user_id);

    if (!currentUser) throw new NotFoundError("User", String(current_user_id));
    if (!targetUser)  throw new NotFoundError("User", String(target_user_id));

    const current = currentUser as any;
    const target  = targetUser  as any;

    if (current.phone_number !== target.phone_number) {
      throw new ValidationError([{
        field: "user_id",
        message: "Target account does not belong to the same phone number",
        code: "ACCOUNT_MISMATCH",
      }]);
    }

    return this._proceedWithUser(target);
  }

  async getLinkedAccounts(current_user_id: number | string): Promise<AccountOption[]> {
    const currentUser = await userRepository.findById(current_user_id);
    if (!currentUser) throw new NotFoundError("User", String(current_user_id));

    const users = await userRepository.findAllByPhoneNumber(
      (currentUser as any).phone_number
    );

    return users.map((u: any) => ({
      user_id:   u.user_id,
      full_name: u.full_name,
      role:      u.role?.role_name ?? "Unknown",
      school_id: u.school_id ?? null,
      status:    u.status,
      avatar:    u.avatar ?? null,
    }));
  }

  private async _proceedWithUser(user: any) {
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

  // ── First-time password reset ───────────────────────────────────────────────
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

  // ── Forgot-password OTP reset ───────────────────────────────────────────────
  async resetPassword(
    phone_number: string,
    newPassword: string,
    confirmPassword: string,
    idToken: string
  ) {
    try {
      await this.verifyIdToken(idToken);
    } catch (error: any) {
      throw new ValidationError(error);
    }

    const user = await userRepository.findByPhoneNumber(phone_number);
    if (!user) throw new NotFoundError("User", phone_number);

    const userData = user as any;

    const hashed = await bcrypt.hash(newPassword, 10);
    await userRepository.update(userData.user_id, { password: hashed });

    return;
  }

  // ── Build full session payload (tokens + profile) ──────────────────────────
  async loginWithUserId(user_id: number | string) {
    const userWithRole: any = await userRepository.findWithRoleAndPermissions(user_id);
    if (!userWithRole)
      throw new NotFoundError("User with role and permissions", String(user_id));

    const permissions = userWithRole.role.permissions.map((p: any) => p.permission_key);

    if (userWithRole.avatar) {
      userWithRole.avatar = await this.signAvatar(
        userWithRole.avatar,
        userWithRole.role.role_name
      );
    }

    const payload = {
      user_id:   userWithRole.user_id,
      role:      userWithRole.role.role_name,
      permissions,
      school_id: userWithRole.school_id,
    };

    const accessToken  = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    return {
      accessToken,
      refreshToken,
      role: payload.role,
      permissions,
      school_id: userWithRole.school_id,
      profile:   userWithRole,
    };
  }

  // ── Sign S3 avatar key → pre-signed URL ────────────────────────────────────
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
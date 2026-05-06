/* =====================================================
   src/controllers/register.controller.js

   REGISTRATION FLOW:
   ──────────────────────────────────────────────────
   Step 1 → POST /api/auth/register
            { role, full_name, username, password,
              phone_number, email, board }
            • board === "CBSE"  → find CBSE school from DB
                                  → create user linked to it
                                  → return otpToken
            • board !== "CBSE" → 403, tell user to contact school

   Step 2 → POST /api/auth/register/resend-otp
            POST /api/auth/register/verify-otp
            Verifies phone → activates account → returns tokens

   Step 3 → GET  /api/auth/register/onboarding  (authed)
            Returns classes, subjects, languages

   Step 4 → POST /api/auth/register/complete-profile (authed)
            Creates StudentProfile or TeacherProfile
   ===================================================== */
import bcrypt from "bcrypt";

import User               from "../models/user.model.js";
import AdminRole          from "../models/admin_role.model.js";
import AdminSchool        from "../models/admin_school.model.js";
import StudentProfile     from "../models/student_profile.model.js";
import TeacherProfile     from "../models/teacher_profile.model.js";
import StudentClassSection from "../models/student_class_section.model.js";
import AdminClass         from "../models/admin_class.model.js";
import AdminSubject       from "../models/admin_subject_master.model.js";

import { ApiError }     from "../utils/ApiError.js";
import { ApiResponse }  from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import {
  generateOTP,
  createOtpToken,
  verifyOtpToken,
} from "../utils/otp.util.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt.util.js";

const VALID_GENDERS   = ["male", "female", "other"];
const ALLOWED_BOARD   = "CBSE";

/* ─────────────────────────────────────────────────────
   HELPER: Find the active CBSE school from DB.
   No hardcoding — purely a DB lookup every time.
   MySQL ENUM comparison is case-insensitive so
   "ACTIVE" in DB matches "Active" in the query.
   ───────────────────────────────────────────────────── */
async function getCbseSchool() {
  const school = await AdminSchool.findOne({
    where: { board: "CBSE", status: "Active" },
  });

  if (!school) {
    throw new ApiError(
      500,
      "No active CBSE school found in the system. Please contact the administrator."
    );
  }

  return school;
}

/* =====================================================
   STEP 1 — REGISTER
   POST /api/auth/register
   ===================================================== */
export const register = asyncHandler(async (req, res) => {
  const {
    role,
    full_name,
    username,
    password,
    phone_number,
    email,
    board,
  } = req.body;

  /* ── Field validation ──────────────────────────────── */
  if (!role || !["STUDENT", "TEACHER"].includes(role))
    throw new ApiError(400, "role must be STUDENT or TEACHER");

  if (!full_name?.trim())    throw new ApiError(400, "full_name is required");
  if (!username?.trim())     throw new ApiError(400, "username is required");
  if (!password)             throw new ApiError(400, "password is required");
  if (!phone_number?.trim()) throw new ApiError(400, "phone_number is required");
  if (!board?.trim())        throw new ApiError(400, "board is required");

  if (password.length < 8)
    throw new ApiError(400, "password must be at least 8 characters");

  if (!/^\+?[0-9]{10,13}$/.test(phone_number.replace(/\s/g, "")))
    throw new ApiError(400, "Enter a valid phone number");

  /* ── BOARD GATE — only CBSE can self-register ──────── */
  if (board.toUpperCase() !== ALLOWED_BOARD) {
    return res.status(403).json({
      success:        false,
      can_register:   false,
      board_selected: board,
      message:
        `Self-registration is currently available for CBSE students and teachers only. ` +
        `If you study or teach at a ${board} school, please ask your school administrator ` +
        `to register the school on the platform — you will then receive an invitation to join.`,
      support_email: process.env.SUPPORT_EMAIL || "support@yourdomain.com",
    });
  }

  /* ── Uniqueness checks ──────────────────────────────── */
  const [takenUsername, takenPhone] = await Promise.all([
    User.findOne({ where: { username: username.trim() } }),
    User.findOne({ where: { phone_number: phone_number.trim() } }),
  ]);

  if (takenUsername) throw new ApiError(409, "Username is already taken");
  if (takenPhone)    throw new ApiError(409, "Phone number is already registered");

  if (email?.trim()) {
    const takenEmail = await User.findOne({ where: { email: email.trim() } });
    if (takenEmail) throw new ApiError(409, "Email is already registered");
  }

  /* ── Role record ────────────────────────────────────── */
  const roleRecord = await AdminRole.findOne({ where: { role_name: role } });
  if (!roleRecord)
    throw new ApiError(500, `Role "${role}" not found. Ask admin to seed roles.`);

  /* ── Get CBSE school from DB — no hardcoding ─────────
     Finds the active CBSE school (e.g. your school_id=22)
     ───────────────────────────────────────────────────── */
  const cbseSchool = await getCbseSchool();

  /* ── Create user ────────────────────────────────────── */
  const hashed = await bcrypt.hash(password, 10);

  const user = await User.create({
    username:                   username.trim(),
    full_name:                  full_name.trim(),
    password:                   hashed,
    phone_number:               phone_number.trim(),
    email:                      email?.trim() || null,
    role_id:                    roleRecord.role_id,
    school_id:                  cbseSchool.school_id,  // dynamically fetched
    status:                     "Pending",
    is_password_reset_required: false,
  });

  /* ── Issue OTP ──────────────────────────────────────── */
  const otp      = generateOTP();
  const otpToken = createOtpToken(phone_number.trim(), otp);

  console.log(`[REGISTER] OTP for ${phone_number} (DEV ONLY):`, otp);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user_id:      user.user_id,
        role,
        school_id:    cbseSchool.school_id,
        school_name:  cbseSchool.school_name,
        can_register: true,
        otpToken,
      },
      "Account created. Please verify your phone number."
    )
  );
});

/* =====================================================
   STEP 2a — RESEND OTP
   POST /api/auth/register/resend-otp
   Body: { phone_number }
   ===================================================== */
export const resendOtp = asyncHandler(async (req, res) => {
  const { phone_number } = req.body;
  if (!phone_number) throw new ApiError(400, "phone_number is required");

  const user = await User.findOne({ where: { phone_number: phone_number.trim() } });
  if (!user)
    throw new ApiError(404, "No account found with this phone number");
  if (user.status === "Active")
    throw new ApiError(400, "Account is already verified. Please login.");

  const otp      = generateOTP();
  const otpToken = createOtpToken(phone_number.trim(), otp);

  console.log(`[RESEND OTP] OTP for ${phone_number} (DEV ONLY):`, otp);

  return res.status(200).json(
    new ApiResponse(200, { otpToken }, "OTP resent successfully")
  );
});

/* =====================================================
   STEP 2b — VERIFY OTP → activate + issue tokens
   POST /api/auth/register/verify-otp
   Body: { phone_number, otp, otpToken }
   ===================================================== */
export const verifyRegistrationOtp = asyncHandler(async (req, res) => {
  const { phone_number, otp, otpToken } = req.body;

  if (!phone_number || !otp || !otpToken)
    throw new ApiError(400, "phone_number, otp, and otpToken are all required");

  verifyOtpToken(phone_number.trim(), otp, otpToken);

  const user = await User.findOne({ where: { phone_number: phone_number.trim() } });
  if (!user) throw new ApiError(404, "User not found");

  if (user.status === "Active")
    throw new ApiError(400, "Account already verified. Please login.");

  await user.update({ status: "Active" });

  const roleRecord = await AdminRole.findOne({ where: { role_id: user.role_id } });

  const payload = {
    user_id:     user.user_id,
    role:        roleRecord?.role_name ?? "STUDENT",
    permissions: [],
    school_id:   user.school_id,
  };

  const accessToken  = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        accessToken,
        role:            payload.role,
        school_id:       user.school_id,
        profileComplete: false,
      },
      "Phone verified. Please complete your profile."
    )
  );
});

/* =====================================================
   STEP 3 — GET ONBOARDING DATA
   GET /api/auth/register/onboarding
   Header: Authorization: Bearer <accessToken>
   ===================================================== */
export const getOnboardingData = asyncHandler(async (req, res) => {
  const { role, school_id } = req.user;

  const [classes, school] = await Promise.all([
    AdminClass.findAll({
      order:      [["class_id", "ASC"]],
      attributes: ["class_id", "class_name"],
    }),
    AdminSchool.findByPk(school_id, {
      attributes: ["school_name", "board", "language_preference"],
    }),
  ]);

  let subjects = [];
  if (role === "TEACHER") {
    subjects = await AdminSubject.findAll({
      where:      { board: school?.board || "CBSE" },
      attributes: ["subject_id", "subject_name", "class_id", "board", "language"],
      order:      [["subject_name", "ASC"]],
    });
  }

  const languages = [
    "English", "Hindi", "Marathi", "Tamil", "Telugu",
    "Kannada", "Bengali", "Gujarati", "Punjabi", "Odia",
  ];

  return res.status(200).json(
    new ApiResponse(200, {
      classes,
      subjects,
      languages,
      school_name:      school?.school_name         ?? null,
      board:            school?.board               ?? "CBSE",
      language_default: school?.language_preference ?? "English",
    }, "Onboarding data fetched")
  );
});

/* =====================================================
   STEP 4 — COMPLETE PROFILE
   POST /api/auth/register/complete-profile
   Header: Authorization: Bearer <accessToken>

   STUDENT body:
   {
     class_id           : number  ← required
     preferred_language : string  ← required
     dob                : string  ← optional "YYYY-MM-DD"
     gender             : string  ← optional male|female|other
     analytics_enabled  : boolean ← optional default false
   }

   TEACHER body:
   {
     primary_subject_id : number  ← required
     preferred_language : string  ← optional
     experience         : number  ← optional
     age                : number  ← optional
     device_type        : string  ← optional Mobile|Tablet|Desktop
   }
   ===================================================== */
export const completeProfile = asyncHandler(async (req, res) => {
  const { user_id, role, school_id } = req.user;

  /* ── STUDENT ────────────────────────────────────── */
  if (role === "STUDENT") {
    const {
      class_id,
      preferred_language,
      dob,
      gender,
      analytics_enabled = false,
    } = req.body;

    if (!class_id)           throw new ApiError(400, "class_id is required");
    if (!preferred_language) throw new ApiError(400, "preferred_language is required");

    if (gender && !VALID_GENDERS.includes(gender))
      throw new ApiError(400, `gender must be one of: ${VALID_GENDERS.join(", ")}`);

    const classRow = await AdminClass.findByPk(class_id);
    if (!classRow) throw new ApiError(404, "Class not found");

    /* Idempotent — safe to retry */
    let profile = await StudentProfile.findOne({ where: { user_id } });

    if (profile) {
      await profile.update({
        preferred_language,
        dob:              dob    || profile.dob,
        gender:           gender || profile.gender,
        analytics_enabled,
      });
    } else {
      profile = await StudentProfile.create({
        user_id,
        school_id,
        preferred_language,
        onboarding_date: new Date(),
        dob:             dob    || null,
        gender:          gender || null,
        analytics_enabled,
      });
    }

    /* Create / update class section row so AI subject
       resolution (getSubjects) works automatically */
    const existingSection = await StudentClassSection.findOne({
      where: { student_id: profile.student_id },
    });

    if (!existingSection) {
      await StudentClassSection.create({
        student_id:    profile.student_id,
        class_id,
        section_id:    null,
        roll_number:   null,
        academic_year: null,
        status:        "active",
      });
    } else {
      await existingSection.update({ class_id });
    }

    /* Bump school student count */
    await AdminSchool.increment("student_count", {
      by: 1, where: { school_id },
    });

    return res.status(200).json(
      new ApiResponse(200, {
        profile,
        class_name:      classRow.class_name,
        profileComplete: true,
      }, "Profile completed. Welcome aboard!")
    );
  }

  /* ── TEACHER ────────────────────────────────────── */
  if (role === "TEACHER") {
    const {
      primary_subject_id,
      preferred_language,
      experience,
      age,
      device_type,
    } = req.body;

    if (!primary_subject_id)
      throw new ApiError(400, "primary_subject_id is required");

    const subjectRow = await AdminSubject.findByPk(primary_subject_id);
    if (!subjectRow) throw new ApiError(404, "Subject not found");

    let profile = await TeacherProfile.findOne({ where: { user_id } });

    if (profile) {
      await profile.update({
        primary_subject_id,
        experience:  experience  || profile.experience,
        age:         age         || profile.age,
        device_type: device_type || profile.device_type,
      });
    } else {
      profile = await TeacherProfile.create({
        user_id,
        school_id,
        primary_subject_id,
        experience:             experience  || null,
        age:                    age         || null,
        device_type:            device_type || null,
        onboarding_date:        new Date(),
        ppt_generation_enabled: false,
        cost_limit:             null,
      });
    }

    /* Bump school teacher count */
    await AdminSchool.increment("teacher_count", {
      by: 1, where: { school_id },
    });

    return res.status(200).json(
      new ApiResponse(200, {
        profile,
        subject_name:    subjectRow.subject_name,
        profileComplete: true,
      }, "Profile completed. Welcome aboard!")
    );
  }

  throw new ApiError(400, "Unsupported role");
});
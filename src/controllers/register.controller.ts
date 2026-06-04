import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import registerService from "../services/register.service.js";
import schoolRepository from "../repositories/school.repository.js";
import AdminClass from "../models/admin_class.model.js";
import AdminSubject from "../models/admin_subject_master.model.js";

// interface AuthenticatedRequest extends Request {
//   user?: any;
// }

async function register (req: Request, res: Response) {
  const result = await registerService.register(req.body);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.status(201).json(

  
    new ApiResponse(201, result, "Account created and verified")
  );
}

const getOnboardingData = asyncHandler(async (req: Request, res: Response) => {
  const { role, school_id } = req.user;

  const [classes, school]: any = await Promise.all([
    AdminClass.findAll({
      order: [["class_id", "ASC"]],
      attributes: ["class_id", "class_name"],
    }),
    schoolRepository.findById(school_id, ["school_name", "board", "language_preference"]),
  ]);

  let subjects:any = [];
  if (role === "TEACHER") {
    subjects = await AdminSubject.findAll({
      where: { board: school?.board || "CBSE" },
      attributes: ["subject_id", "subject_name", "class_id", "board", "language"],
      order: [["subject_name", "ASC"]],
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
      school_name: school?.school_name ?? null,
      board: school?.board ?? "CBSE",
      language_default: school?.language_preference ?? "English",
    }, "Onboarding data fetched")
  );
});

const completeProfile = asyncHandler(async (req: Request, res: Response) => {
  const { user_id, role, school_id } = req.user;
  let profile: any;

  if (role === "STUDENT") {
    profile = await registerService.completeStudentProfile(String(user_id), String(school_id), req.body);
  } else if (role === "TEACHER") {
    profile = await registerService.completeTeacherProfile(String(user_id), String(school_id), req.body);
  }

  return res.status(200).json(
    new ApiResponse(200, { profile, profileComplete: true }, "Profile completed")
  );
});

export {
  register,
  getOnboardingData,
  completeProfile,
  resendOtp,
  verifyRegistrationOtp,
};

async function resendOtp(req: Request, res: Response) {
  const { phone_number } = req.body;
  const result = await registerService.resendOtp(phone_number);
  console.log(`[RESEND OTP] OTP (DEV ONLY):`, result.otp);
  return res.status(200).json(new ApiResponse(200, { otpToken: result.otpToken }, "OTP resent"));
}

async function verifyRegistrationOtp(req: Request, res: Response) {
  const { phone_number, otp, otpToken } = req.body;
  const result = await registerService.verifyRegistrationOtp(phone_number, otp, otpToken);

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.status(200).json(new ApiResponse(200, result, "Phone verified"));
}

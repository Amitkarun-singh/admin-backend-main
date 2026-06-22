import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import registerService from "../services/register.service.js";
import schoolRepository from "../repositories/school.repository.js";
import CurriculumService from "../services/curriculum.service.js";

// interface AuthenticatedRequest extends Request {
//   user?: any;
// }

async function register(req: Request, res: Response) {
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

  const [classesRaw, school]: any = await Promise.all([
    CurriculumService.allClass(),
    schoolRepository.findById(school_id, ["school_name", "board", "language_preference"]),
  ]);
  const classes = (classesRaw?.data ?? classesRaw ?? []).map((c: any) => ({
    class_id: c.id ?? c.class_id,
    class_name: c.class_name,
  }));

  let subjects: any[] = [];
  if (role === "TEACHER") {
    // Fetch subjects for every class and flatten — curriculum service has no global subject endpoint
    try {
      const allSubjects: any[] = [];
      for (const cls of classes) {
        const raw = await CurriculumService.allSubject(cls.class_id, school?.board || "CBSE", 4);
        const list: any[] = raw?.data ?? raw ?? [];
        list.forEach((s: any) => allSubjects.push({
          subject_id: s.id ?? s.subject_id,
          subject_name: s.subject_name ?? s.name,
          class_id: cls.class_id,
          board: s.board,
          language: s.language,
        }));
      }
      subjects = allSubjects;
    } catch {
      subjects = [];
    }
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


///////////////////////////////////////////////////////////////////////////////////////////////////////////////

export async function getClasses(req: Request, res: Response) {
  const result = await CurriculumService.allClass();
  return res.status(200).json(new ApiResponse(200, result, "Classes fetched successfully"));
}

export async function getStream(req: Request, res: Response) {
  const result = await CurriculumService.stream();
  return res.status(200).json(new ApiResponse(200, result, "Stream fetched successfully"));
}

export async function verifyUsername(req: Request, res: Response) {
  const { username } = req.body;
  const result = await registerService.verifyUsername(username);
  return res.status(200).json(new ApiResponse(200, result, "Username verified successfully"));
}

export async function verifyPhoneNumber(req: Request, res: Response) {
  const { phone_number } = req.body;
  const result = await registerService.verifyPhoneNumber(phone_number);
  return res.status(200).json(new ApiResponse(200, result, "Phone number verified successfully"));
}
import bcrypt from "bcrypt";
import userRepository from "../repositories/user.repository.js";
import roleRepository from "../repositories/role.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import CurriculumService from "./curriculum.service.js";
import authService from "./auth.service.ts";
import { ApiError } from "../utils/ApiError.js";
import { generateOTP, createOtpToken, verifyOtpToken } from "../utils/otp.util.js";
import { ValidationError } from "../error/subError.ts";
import { AdminRole, AdminSchool, StudentProfile, TeacherProfile, User } from "../models/index.js";

const GENERAL_STREAM_ID = 4;
const STREAM_REQUIRED_FROM_GRADE = 11;

export class RegisterService {
  //self register user
  async register(registerData: any) {
    const {
      role,
      full_name,
      username,
      password,
      phone_number,
      email,
      board,
      idToken,
      self_register,
      section_name,
      stream,
    } = registerData;


    const validation = [];

    // Firebase verification
    await authService.verifyIdToken(idToken);

    // Board check
    if (board.toUpperCase() !== "CBSE") {
      validation.push({
        field: "board",
        message: "Self-registration is only for CBSE",
        code: "BOARD_NOT_SUPPORTED",
      });
    }

    // Uniqueness checks
    const contact_number = phone_number.trim().slice(-10);
    const takenPhone = await userRepository.findByPhoneNumber(contact_number);

    if (takenPhone) {
      validation.push({
        field: "phone_number",
        message: "Phone number already registered",
        code: "DUPLICATE_PHONE",
      });
    }

    if (email?.trim()) {
      const takenEmail = await userRepository.findByEmail(email.trim());
      if (takenEmail) {
        validation.push({
          field: "email",
          message: "Email already registered",
          code: "DUPLICATE_EMAIL",
        });
      }
    }

    if (username) {
      const takenUsername = await userRepository.findByUsername(username);
      if (takenUsername) {
        validation.push({
          field: "username",
          message: "Username already registered",
          code: "DUPLICATE_USERNAME",
        });
      }
    }

    // Role and School
    const roleRecord: AdminRole | null = await roleRepository.findByName(role);
    if (!roleRecord) {
      validation.push({
        field: "role",
        message: "Role not found",
        code: "ROLE_NOT_FOUND",
      });
    }

    const cbseSchool: AdminSchool | null = await schoolRepository.findActiveCbseSchool();
    if (!cbseSchool) {
      validation.push({
        field: "school",
        message: "Active CBSE school not found",
        code: "SCHOOL_NOT_FOUND",
      });
    }

    if (validation.length > 0) {
      throw new ValidationError(validation);
    }

    // ── Curriculum data fetch ─────────────────────────────────────────────────
    let: any[] = [];
    let allSections: any[] = [];
    let allStreams: any[] = [];

    try {
      const [classesRes, sectionsRes, streamsRes] = await Promise.all([
        CurriculumService.allClass(),
        CurriculumService.section(),
        CurriculumService.stream(),
      ]);
      allClasses = classesRes?.data ?? classesRes ?? [];
      allSections = sectionsRes?.data ?? sectionsRes ?? [];
      allStreams = streamsRes?.data ?? streamsRes ?? [];
    } catch {
      throw new ApiError(503, "Curriculum service unavailable");
    }

    // ── Class resolution ──────────────────────────────────────────────────────
    const inputClasses: string[] = registerData.class
      ? registerData.class.split(",").map((c: string) => c.trim())
      : [];

    let classRecords: Array<{ class_id: number; class_name: string }> = [];
    let resolvedClassId: number | null = null;
    let gradeNumber: number | null = null;

    if (inputClasses.length > 0) {
      try {
        const raw = await CurriculumService.allClass();
        const allClasses: any[] = raw?.data ?? raw ?? [];
        const normalized = allClasses.map((c: any) => ({
          class_id: Number(c.id ?? c.class_id),
          class_name: String(c.class_name),
        }));

        const patterns: string[] = [];
        inputClasses.forEach((c: string) => {
          if (c.toLowerCase().startsWith("grade")) {
            patterns.push(c.toLowerCase());
          } else {
            patterns.push(`grade ${c.toLowerCase()}`);
            patterns.push(`grade${c.toLowerCase()}`);
          }
        });

      } catch (error: any) {
        throw new ValidationError(validation);
      }

      if (classRecords.length > 0) {
        resolvedClassId = classRecords[0].class_id;
        // Extract grade number from class name for stream resolution
        const match = classRecords[0].class_name.match(/\d+/);
        gradeNumber = match ? parseInt(match[0], 10) : null;
      }
    }

    // ── Section resolution (STUDENT only) ─────────────────────────────────────
    let resolvedSectionId: number | null = null;

    if (role.toUpperCase() === "STUDENT" && section_name) {
      const normalizedSectionName = String(section_name).trim().toUpperCase();
      const sectionRecord = allSections.find(
        (s: any) => s.section_name === normalizedSectionName,
      );
      if (!sectionRecord) {
        throw new ApiError(
          400,
          `Section "${normalizedSectionName}" does not exist. Please create it first.`,
        );
      }
      resolvedSectionId = sectionRecord.id;
    }

    // ── Stream resolution (STUDENT only) ──────────────────────────────────────
    let resolvedStreamId: number = GENERAL_STREAM_ID;

    if (role.toUpperCase() === "STUDENT" && gradeNumber !== null) {
      if (gradeNumber >= STREAM_REQUIRED_FROM_GRADE) {
        const validStreams = allStreams.filter(
          (s: any) => Number(s.id) !== GENERAL_STREAM_ID,
        );
        const validNames = validStreams.map((s: any) => s.stream_name).join(", ");

        if (!stream?.trim()) {
          throw new ApiError(
            400,
            `stream is required for Grade ${gradeNumber}. Valid options: ${validNames}`,
          );
        }

        const streamRecord = allStreams.find(
          (s: any) =>
            String(s.stream_name).trim().toLowerCase() ===
            String(stream).trim().toLowerCase(),
        );

        if (!streamRecord) {
          throw new ApiError(
            400,
            `Stream "${stream}" not found. Valid options for Grade ${gradeNumber}: ${validNames}`,
          );
        }

        resolvedStreamId = Number(streamRecord.id);
      } else {
        // Grade < 11 → always General
        resolvedStreamId = GENERAL_STREAM_ID;
      }
    }

    // ── Create User ───────────────────────────────────────────────────────────
    const hashed = await bcrypt.hash(password, 10);
    const user: User = await userRepository.create({
      full_name: full_name.trim(),
      password: hashed,
      username: username,
      phone_number: contact_number,
      email: email?.trim() || null,
      role_id: roleRecord!.role_id,
      school_id: cbseSchool!.school_id,
      status: "Active",
      is_password_reset_required: false,
      self_register,
      token: 10000
    });



    const currentYear = new Date().getFullYear().toString();

    // ── Create Profile and Class Association based on Role ────────────────────
    if (role.toUpperCase() === "TEACHER") {
      const teacherProfile: TeacherProfile = await profileRepository.createTeacherProfile({
        user_id: (user as any).user_id,
        school_id: cbseSchool!.school_id,
        onboarding_date: new Date(),
      });

      // Link classes
      for (const cls of classRecords) {
        await profileRepository.createTeacherClassSectionSubject({
          teacher_id: teacherProfile.teacher_id,
          class_id: (cls as any).class_id,
          academic_year: currentYear,
        });
      }

      await schoolRepository.incrementCount(cbseSchool!.school_id, "teacher_count");
    } else if (role.toUpperCase() === "STUDENT") {
      const studentProfile: StudentProfile = await profileRepository.createStudentProfile({
        user_id: (user as any).user_id,
        school_id: cbseSchool!.school_id,
        onboarding_date: new Date(),
      });

      // Link first class (students only have one)
      if (classRecords.length > 0) {
        await profileRepository.createStudentClassSection({
          student_id: studentProfile.student_id,
          class_id: classRecords[0].class_id,
          academic_year: currentYear,
          status: "active",
        });
      }

      // ── Assign class in curriculum microservice ──────────────────────────
      if (resolvedClassId !== null) {
        try {
          await CurriculumService.assignClass({
            userId: Number((user as any).user_id),
            schoolId: Number(cbseSchool!.school_id),
            classId: resolvedClassId,
            streamId: resolvedStreamId,
            sectionId: resolvedSectionId ?? 0,
          });
        } catch (e: any) {
          throw new ApiError(
            503,
            `Failed to assign class in curriculum service: ${e?.message ?? "unknown error"}`,
          );
        }
      }

      await schoolRepository.incrementCount(cbseSchool!.school_id, "student_count");
    }

    // Login after registration
    return await authService.loginWithUserId((user as any).user_id);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async completeStudentProfile(
    user_id: number | string,
    school_id: number | string,
    profileData: any,
  ) {
    const { class_id, preferred_language, dob, gender, analytics_enabled } = profileData;

    let profile: any = await profileRepository.findStudentByUserId(user_id);
    if (profile) {
      await profile.update({
        preferred_language,
        dob,
        gender,
        analytics_enabled,
      });
    } else {
      profile = await profileRepository.createStudentProfile({
        user_id,
        school_id,
        preferred_language,
        onboarding_date: new Date(),
        dob,
        gender,
        analytics_enabled,
      });
    }

    // Handle class section
    const existingSection = await profileRepository.findStudentClassSection(profile.student_id);
    if (!existingSection) {
      await profileRepository.createStudentClassSection({
        student_id: profile.student_id,
        class_id,
        status: "active",
      });
    } else {
      await existingSection.update({ class_id });
    }

    // Increment count
    await schoolRepository.incrementCount(school_id, "student_count");

    return profile;
  }

  ///////////////////////////////////////////////////////////////////////////

  async completeTeacherProfile(
    user_id: number | string,
    school_id: number | string,
    profileData: any,
  ) {
    const { primary_subject_id, preferred_language, experience, age, device_type } = profileData;

    let profile: any = await profileRepository.findTeacherByUserId(user_id);
    if (profile) {
      await profile.update({
        primary_subject_id,
        preferred_language,
        experience,
        age,
        device_type,
      });
    } else {
      profile = await profileRepository.createTeacherProfile({
        user_id,
        school_id,
        primary_subject_id,
        experience,
        age,
        device_type,
        onboarding_date: new Date(),
      });
    }

    // Increment count
    await schoolRepository.incrementCount(school_id, "teacher_count");

    return profile;
  }

  async resendOtp(phone_number: string) {
    const contact_number = phone_number.trim().slice(-10);
    const user = await userRepository.findByPhoneNumber(contact_number);
    if (!user) throw new ApiError(404, "No account found");
    if ((user as any).status === "Active") throw new ApiError(400, "Account already verified");

    const otp = generateOTP();
    const otpToken = createOtpToken(contact_number, otp);
    return { otpToken, otp };
  }

  async verifyRegistrationOtp(phone_number: string, otp: string, otpToken: string) {
    const contact_number = phone_number.trim().slice(-10);
    verifyOtpToken(contact_number, otp, otpToken);

    const user = await userRepository.findByPhoneNumber(contact_number);
    if (!user) throw new ApiError(404, "User not found");

    await userRepository.update((user as any).user_id, { status: "Active" });
    return await authService.loginWithUserId((user as any).user_id);
  }

  async verifyUsername(username: string) {
    const user = await userRepository.findByUsername(username);
    if (user) throw new ApiError(400, "Username already taken");
    return { available: true };
  }

  async verifyPhoneNumber(phone_number: string) {
    const user = await userRepository.findByPhoneNumber(phone_number);
    if (user) throw new ApiError(400, "Phone number already taken");
    return { available: true };
  }
}

export default new RegisterService();



import bcrypt from "bcrypt";
import userRepository from "../repositories/user.repository.js";
import roleRepository from "../repositories/role.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import classRepository from "../repositories/class.repository.js";
import authService from "./auth.service.ts";
import { ApiError } from "../utils/ApiError.js";
import { generateOTP, createOtpToken, verifyOtpToken } from "../utils/otp.util.js";
import { ValidationError } from "../error/subError.ts";
import { AdminRole, AdminSchool, StudentProfile, TeacherProfile, User } from "../models/index.js";

export class RegisterService {
  //self register user
  async register(registerData: any) {
    const {
      role,
      full_name,
      password,
      phone_number,
      email,
      board,
      idToken,
      self_register
   
    } = registerData;
    console.log(registerData)



    const validation = []

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

    // Role and School
    const roleRecord: AdminRole = await roleRepository.findByName(role);
    if (!roleRecord) {
      validation.push({
        field: "role",
        message: "Role not found",
        code: "ROLE_NOT_FOUND",
      });
    }

    const cbseSchool: AdminSchool = await schoolRepository.findActiveCbseSchool();
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

    // Class mapping
    const inputClasses: string[] = registerData.class ? registerData.class.split(',').map((c: string) => c.trim()) : [];
    const searchPatterns: string[] = [];
    inputClasses.forEach((c: string) => {
      if (c.toLowerCase().startsWith("grade")) {
        searchPatterns.push(c);
      } else {
        searchPatterns.push(`Grade ${c}`);
        searchPatterns.push(`Grade${c}`);
      }
    });

    const classRecords = searchPatterns.length > 0 ? await classRepository.findByNames(searchPatterns) : [];

    // Check if we found at least one record for each input class
    const foundClassNames = classRecords.map((r: any) => r.class_name.toLowerCase());
    const missingClasses = inputClasses.filter((input: string) => {
      const patterns = input.toLowerCase().startsWith("grade") 
        ? [input.toLowerCase()] 
        : [`grade ${input.toLowerCase()}`, `grade${input.toLowerCase()}`];
      return !patterns.some((p: string) => foundClassNames.includes(p));
    });

    if (inputClasses.length > 0 && missingClasses.length > 0) {
      validation.push({
        field: "class",
        message: `Classes not found: ${missingClasses.join(', ')}`,
        code: "CLASS_NOT_FOUND",
      });
      throw new ValidationError(validation);
    }

    

    // Create User
    const hashed = await bcrypt.hash(password, 10);
    const user: User = await userRepository.create({
      full_name: full_name.trim(),
      password: hashed,
      phone_number: contact_number,
      email: email?.trim() || null,
      role_id: roleRecord.role_id,
      school_id: cbseSchool.school_id,
      status: "Active",
      is_password_reset_required: false,
      self_register
    });

    const currentYear = new Date().getFullYear().toString();

    // Create Profile and Class Association based on Role
    if (role.toUpperCase() === "TEACHER") {
      const teacherProfile: TeacherProfile = await profileRepository.createTeacherProfile({
        user_id: user.user_id,
        school_id: cbseSchool.school_id,
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
      
      await schoolRepository.incrementCount(cbseSchool.school_id, "teacher_count");
    } else if (role.toUpperCase() === "STUDENT") {
      const studentProfile: StudentProfile = await profileRepository.createStudentProfile({
        user_id: user.user_id,
        school_id: cbseSchool.school_id,
        onboarding_date: new Date(),
      });

      // Link first class (students only have one)
      if (classRecords.length > 0) {
        await profileRepository.createStudentClassSection({
          student_id: studentProfile.student_id,
          class_id: (classRecords[0] as any).class_id,
          academic_year: currentYear,
          status: "active",
        });
      }

      await schoolRepository.incrementCount(cbseSchool.school_id, "student_count");
    }

    // Login after registration
    return await authService.loginWithUserId(user.user_id);
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  async completeStudentProfile(user_id: number | string, school_id: number | string, profileData: any) {
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

  async completeTeacherProfile(user_id: number | string, school_id: number | string, profileData: any) {
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
}

export default new RegisterService();

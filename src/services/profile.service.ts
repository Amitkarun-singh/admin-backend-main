

import userRepository from "../repositories/user.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import classRepository from "../repositories/class.repository.js";
import UserStreak from "../models/user_streak.model.js";
import sequelize from "../config/db.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";



class ProfileService {

  async getUserProfile(user_id: number, role: string, school_id: number) {
    let profileData: any = null;

    if (["ADMIN", "SUBADMIN"].includes(role)) {
      return profileData = await this.getAdminProfile(user_id, role);
    } else if (role === "TEACHER") {
      return profileData = await this.getTeacherProfile(user_id);
    } else if (role === "STUDENT") {
      return profileData = await this.getStudentProfile(user_id);
    }


  }

  /* =====================================================
       STUDENT PROFILE
    ===================================================== */
  async getStudentProfile(user_id: number) {

    const [student, user, streak] = await Promise.all([
      profileRepository.findStudentByUserId(user_id),
      userRepository.findWithRoleAndPermissions(user_id),
      this.getStreakData(user_id),
    ]);

    const [school, classSection, overall_score] = await Promise.all([
      student?.school_id
        ? schoolRepository.findById(student.school_id)
        : Promise.resolve(null),

      student
        ? profileRepository.findStudentClassSection(student.student_id)
        : Promise.resolve(null),

      this.getOverallScore(user_id),
    ]);

    const [studentClass, studentSection] = await Promise.all([
      classSection?.class_id
        ? classRepository.findById(classSection.class_id)
        : Promise.resolve(null),

      classSection?.section_id
        ? classRepository.findSectionById(classSection.section_id)
        : Promise.resolve(null),
    ]);

    const avatarUrl = await this.signAvatar((user as any)?.avatar, "STUDENT");

    return {
      role: "STUDENT",
      avatar: avatarUrl,

      gender: student?.gender?.toLowerCase() || null,
      dob: student?.dob || null,
      language: student?.preferred_language || null,

      full_name: user?.full_name || null,
      number: user?.phone_number || null,
      email: user?.email || null,

      school_name: school?.school_name || null,
      board_name: school?.board || null,

      class_id: classSection?.class_id || null,
      section_id: classSection?.section_id || null,

      class_name: studentClass?.class_name || null,
      section_name: studentSection?.section_name || null,

      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_active_date: streak.last_active_date,

      overall_score,
    };
  }

  /* =====================================================
     TEACHER PROFILE
  ===================================================== */
  async getTeacherProfile(user_id: number) {

    const [teacher, user, streak] = await Promise.all([
      profileRepository.findTeacherByUserId(user_id),
      userRepository.findWithRoleAndPermissions(user_id),
      this.getStreakData(user_id),
    ]);

    const [school, teacherClasses] = await Promise.all([
      teacher?.school_id
        ? schoolRepository.findById(teacher.school_id)
        : Promise.resolve(null),

      teacher
        ? profileRepository.findTeacherClassSections(teacher.teacher_id)
        : Promise.resolve([]),
    ]);

    const classSection = teacherClasses?.[0] || null;

    const [teacherClass, teacherSection] = await Promise.all([
      classSection?.class_id
        ? classRepository.findById(classSection.class_id)
        : Promise.resolve(null),

      classSection?.section_id
        ? classRepository.findSectionById(classSection.section_id)
        : Promise.resolve(null),
    ]);

    const avatarUrl = await this.signAvatar((user as any)?.avatar, "TEACHER");

    return {
      role: "TEACHER",
      avatar: avatarUrl,

      gender: teacher?.gender?.toLowerCase() || null,
      dob: teacher?.dob || null,
      language: teacher?.preferred_language || null,

      full_name: user?.full_name || null,
      number: user?.phone_number || null,
      email: user?.email || null,

      school_name: school?.school_name || null,
      board_name: school?.board || null,

      class_name: teacherClass?.class_name || null,
      section_name: teacherSection?.section_name || null,

      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_active_date: streak.last_active_date,
    };
  }

  /* =====================================================
     ADMIN / SUBADMIN PROFILE
  ===================================================== */
  async getAdminProfile(user_id: number, role: string) {

    const [user, streak] = await Promise.all([
      userRepository.findWithRoleAndPermissions(user_id),
      this.getStreakData(user_id),
    ]);

    const avatarUrl = await this.signAvatar((user as any)?.avatar, role);

    return {
      role,
      avatar: avatarUrl,

      full_name: user?.full_name || null,
      number: user?.phone_number || null,
      email: user?.email || null,

      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
      last_active_date: streak.last_active_date,
    };
  }

  /* ─────────────────────────────────────────────────────────────
   HELPER: sign avatar S3 key → URL (null if no avatar yet)
───────────────────────────────────────────────────────────── */
  async signAvatar(key: string | null | undefined, role: string): Promise<string | null> {
    if (!key) return null;
    try {
      const url = await getSignedPdfUrl(key);
      return url ?? null;
    } catch (err: any) {
      console.error(`[AVATAR][${role}] signing failed:`, err.message);
      return null;
    }
  }

  /* ─────────────────────────────────────────────────────────────
   HELPER: get streak info for any user
   Returns zeros safely if the row doesn't exist yet
 ───────────────────────────────────────────────────────────── */
  async getStreakData(user_id: number) {
    try {
      const row: any = await UserStreak.findOne({ where: { user_id } });
      return {
        current_streak: row?.current_streak ?? 0,
        longest_streak: row?.longest_streak ?? 0,
        last_active_date: row?.last_active_date ?? null,
      };
    } catch {
      return { current_streak: 0, longest_streak: 0, last_active_date: null };
    }
  }

  /* ─────────────────────────────────────────────────────────────
     HELPER: get overall practice score (0-100) for a student
  ───────────────────────────────────────────────────────────── */
  async getOverallScore(student_id: number): Promise<number> {
    try {
      const [row]: any = await sequelize.query(
        `SELECT ROUND(AVG(pq.is_correct) * 100) AS overallScore
       FROM   practice_tests pt
       JOIN   practice_questions pq ON pt.id = pq.test_id
       WHERE  pt.student_id = :student_id`,
        { replacements: { student_id }, type: (sequelize as any).QueryTypes.SELECT }
      );
      return Number(row?.overallScore ?? 0);
    } catch {
      return 0;
    }
  }



}

export default new ProfileService();

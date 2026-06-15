import userRepository from "../repositories/user.repository.js";
import schoolRepository from "../repositories/school.repository.js";
import profileRepository from "../repositories/profile.repository.js";
import curriculumService from "./curriculum.service.js";
import { fetchCurriculumMapsSafe } from "../utils/curriculumEnrich.js";
import UserStreak from "../models/user_streak.model.js";
import sequelize from "../config/db.js";
import { getSignedPdfUrl } from "../utils/signedUrl.js";

import { uploadAvatarToS3 } from "../utils/s3Upload.js";



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

    const [studentClass, studentSection] = await this._resolveClassSection(
      classSection?.class_id,
      classSection?.section_id,
    );

    const avatarUrl = await getSignedPdfUrl((user as any)?.avatar);

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

    const [teacherClass, teacherSection] = await this._resolveClassSection(
      classSection?.class_id,
      classSection?.section_id,
    );

    const avatarUrl = await getSignedPdfUrl((user as any)?.avatar);

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

  const school_id = (user as any)?.school_id;

  const school = school_id
    ? await schoolRepository.findById(school_id)
    : null;

  const avatarUrl = await getSignedPdfUrl((user as any)?.avatar);

  return {
    role,
    avatar: avatarUrl,

    // Basic user details
    full_name: user?.full_name || null,
    number: user?.phone_number || null,
    email: user?.email || null,

    // School details
    school_id: school?.school_id || null,
    school_name: school?.school_name || null,
    board: school?.board || null,
    country: school?.country || null,
    state: school?.state || null,
    city: school?.city || null,
    pincode: school?.pincode || null,
    timezone: school?.timezone || null,
    language_preference: school?.language_preference || null,
    website_enabled: school?.website_enabled ?? null,
    allowed_domains: school?.allowed_domains || null,
    onboard_date: school?.onboard_date || null,
    status: school?.status || null,

    // Number/count details
    student_count: school?.student_count ?? 0,
    teacher_count: school?.teacher_count ?? 0,
    class_count: school?.class_count ?? 0,
    cost: school?.cost ?? null,

    // Streak
    current_streak: streak.current_streak,
    longest_streak: streak.longest_streak,
    last_active_date: streak.last_active_date,
  };
}

  /* ──────────────────────────────────────────────────────────
   HELPER: resolve class_id + section_id to names via
   curriculum microservice. Returns [classObj, sectionObj] where
   each has a .class_name / .section_name property (or null).
  ────────────────────────────────────────────────────────── */
  async _resolveClassSection(class_id: any, section_id: any) {
    try {
      const [classesRaw, sectionsRaw] = await Promise.all([
        curriculumService.allClass(),
        curriculumService.section(),
      ]);
      const classes  = classesRaw?.data  ?? classesRaw  ?? [];
      const sections = sectionsRaw?.data ?? sectionsRaw ?? [];
      const classObj   = class_id   ? classes.find((c: any)  => Number(c.id ?? c.class_id)   === Number(class_id))   ?? null : null;
      const sectionObj = section_id ? sections.find((s: any) => Number(s.id ?? s.section_id) === Number(section_id)) ?? null : null;
      return [
        classObj   ? { class_name:   classObj.class_name }   : null,
        sectionObj ? { section_name: sectionObj.section_name } : null,
      ];
    } catch {
      return [null, null];
    }
  }

  /* ───────────────────────────────────────────────────────────── */


  async getMyAvatar(user_id: number) {
    const user: any = await userRepository.findById(user_id);

    if (!user) {
      return { avatar: null };
    }

    const avatarUrl = await getSignedPdfUrl(user.avatar);

    return { avatar: avatarUrl };
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

  async updateAvatar(user_id: string, file: Express.Multer.File) {

    const { key } = await uploadAvatarToS3(file, user_id);
    await userRepository.update(user_id, { avatar: key });


    return { avatar: key };
  }



}

export default new ProfileService();

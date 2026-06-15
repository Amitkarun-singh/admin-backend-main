/* =====================================================
   IMPORT ALL MODELS
   Associations are wired here and re-exported.
   Sync logic lives in src/index.ts — never here.
   ===================================================== */
import User from "./user.model.ts";
import AdminSchool from "./admin_school.model.ts";

import StudentProfile from "./student_profile.model.ts";
import TeacherProfile from "./teacher_profile.model.ts";
import ParentProfile from "./parent_profile.model.js";

import ParentStudentMap from "./parent_student_map.model.ts";
import StudentClassSection from "./student_class_section.model.js";
import StudentAnalytics from "./student_analytics.model.js";

import TeacherAnalytics from "./teacher_analytics.model.js";
import TeacherClassSectionSubject from "./teacher_class_section_subject.model.ts";

import AdminRole from "./admin_role.model.ts";
import AdminPermission from "./admin_permission.model.ts";
import AdminRolePermission from "./admin_role_permission.model.js";

import AdminCourse from "./admin_course.model.ts";

import GiniLog from "./gini_log.model.js";
import TutorLog from "./Tutor_log.model.js";
import PracticeLog from "./practice_log.model.ts";
import UserSession from "./user_session.model.js";

import Assessment from "./assessment.model.js";
import AssessmentQuestion from "./assessment_question.model.js";
import AssessmentAssignment from "./assessment_assignment.model.js";
import { StudentAttempt, StudentAnswer } from "./student_attempt.model.js";

import Feature from "./feature.model.js";
import SchoolFeature from "./school_feature.model.js";
import FeatureOverride from "./feature_overrides.model.js";

/* =====================================================
   USER ↔ ROLE  (RBAC)
   ===================================================== */
AdminRole.hasMany(User, { foreignKey: "role_id", as: "users" });
User.belongsTo(AdminRole, { foreignKey: "role_id", as: "role" });

/* =====================================================
   ROLE ↔ PERMISSIONS  (Many-to-Many)
   ===================================================== */
AdminRole.belongsToMany(AdminPermission, {
  through: AdminRolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions",
});
AdminPermission.belongsToMany(AdminRole, {
  through: AdminRolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles",
});

/* =====================================================
   SCHOOL ↔ USER
   ===================================================== */
AdminSchool.hasMany(User, { foreignKey: "school_id", as: "users" });
User.belongsTo(AdminSchool, { foreignKey: "school_id", as: "school" });

/* =====================================================
   USER ↔ STUDENT PROFILE
   ===================================================== */
User.hasOne(StudentProfile, { foreignKey: "user_id", as: "student" });
StudentProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   USER ↔ TEACHER PROFILE
   ===================================================== */
User.hasOne(TeacherProfile, { foreignKey: "user_id", as: "teacher" });
TeacherProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   USER ↔ PARENT PROFILE
   ===================================================== */
User.hasOne(ParentProfile, { foreignKey: "user_id", as: "parent" });
ParentProfile.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   PARENT ↔ STUDENT  (Many-to-Many via ParentStudentMap)
   ===================================================== */
ParentProfile.belongsToMany(StudentProfile, {
  through: ParentStudentMap,
  foreignKey: "parent_id",
  otherKey: "student_id",
  as: "students",
});
StudentProfile.belongsToMany(ParentProfile, {
  through: ParentStudentMap,
  foreignKey: "student_id",
  otherKey: "parent_id",
  as: "parents",
});

/* =====================================================
   STUDENT ↔ CLASS-SECTION
   class_id and section_id in student_class_section are curriculum-service IDs.
   No local FK associations to AdminClass/AdminSection (those models are removed).
   ===================================================== */
StudentProfile.hasOne(StudentClassSection, {
  foreignKey: "student_id",
  as: "classSection",
});
StudentClassSection.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student",
});

/* =====================================================
   STUDENT ANALYTICS
   ===================================================== */
StudentProfile.hasOne(StudentAnalytics, {
  foreignKey: "student_id",
  as: "analytics",
});
StudentAnalytics.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student",
});

/* =====================================================
   TEACHER ↔ CLASS-SECTION-SUBJECT
   class_id, section_id, class_subject_id are curriculum-service IDs.
   Only the teacher_id FK to TeacherProfile is a local association.
   ===================================================== */
TeacherProfile.hasMany(TeacherClassSectionSubject, {
  foreignKey: "teacher_id",
  as: "assignments",
});
TeacherClassSectionSubject.belongsTo(TeacherProfile, {
  foreignKey: "teacher_id",
  as: "teacher",
});

/* =====================================================
   TEACHER ANALYTICS
   ===================================================== */
TeacherProfile.hasOne(TeacherAnalytics, {
  foreignKey: "teacher_id",
  as: "analytics",
});
TeacherAnalytics.belongsTo(TeacherProfile, {
  foreignKey: "teacher_id",
  as: "teacher",
});


/* =====================================================
   USER ↔ USER SESSIONS
   ===================================================== */
User.hasMany(UserSession, { foreignKey: "user_id", as: "sessions" });
UserSession.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   USER ↔ GINI LOGS
   ===================================================== */
User.hasMany(GiniLog, { foreignKey: "user_id", as: "giniLogs" });
GiniLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   USER ↔ PRACTICE LOGS
   ===================================================== */
User.hasMany(PracticeLog, { foreignKey: "user_id", as: "practiceLogs" });
PracticeLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   USER ↔ TUTOR LOGS
   ===================================================== */
User.hasMany(TutorLog, { foreignKey: "user_id", as: "tutorLogs" });
TutorLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   ASSESSMENT ENGINE ASSOCIATIONS
   ===================================================== */

User.hasMany(Assessment, { foreignKey: "created_by", as: "assessments" });
Assessment.belongsTo(User, { foreignKey: "created_by", as: "creator" });

Assessment.hasMany(AssessmentQuestion, {
  foreignKey: "assessment_id",
  as: "questions",
});
AssessmentQuestion.belongsTo(Assessment, {
  foreignKey: "assessment_id",
  as: "assessment",
});

Assessment.hasMany(AssessmentAssignment, {
  foreignKey: "assessment_id",
  as: "assignments",
});
AssessmentAssignment.belongsTo(Assessment, {
  foreignKey: "assessment_id",
  as: "assessment",
});

AssessmentAssignment.hasMany(StudentAttempt, {
  foreignKey: "assignment_id",
  as: "attempts",
});
StudentAttempt.belongsTo(AssessmentAssignment, {
  foreignKey: "assignment_id",
  as: "assignment",
});

StudentAttempt.hasMany(StudentAnswer, {
  foreignKey: "attempt_id",
  as: "answers",
});
StudentAnswer.belongsTo(StudentAttempt, {
  foreignKey: "attempt_id",
  as: "attempt",
});

StudentAnswer.belongsTo(AssessmentQuestion, {
  foreignKey: "question_id",
  as: "question",
});

StudentProfile.hasMany(StudentAttempt, {
  foreignKey: "student_id",
  as: "attempts",
});
StudentAttempt.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student",
});

/* =====================================================
   FEATURE FLAGS
   ===================================================== */
AdminSchool.hasMany(SchoolFeature, { foreignKey: "school_id", as: "schoolFeatures" });
SchoolFeature.belongsTo(AdminSchool, { foreignKey: "school_id", as: "school" });

Feature.hasMany(SchoolFeature, { foreignKey: "feature_id", as: "schoolGrants" });
SchoolFeature.belongsTo(Feature, { foreignKey: "feature_id", as: "feature" });

// FeatureOverride associations intentionally omitted — see model comment.

/* =====================================================
   EXPORT ALL MODELS
   ===================================================== */
export {
  User,
  AdminSchool,
  StudentProfile,
  TeacherProfile,
  ParentProfile,
  ParentStudentMap,
  StudentClassSection,
  StudentAnalytics,
  TeacherAnalytics,
  TeacherClassSectionSubject,
  AdminRole,
  AdminPermission,
  AdminRolePermission,
  AdminCourse,
  GiniLog,
  PracticeLog,
  UserSession,
  TutorLog,
  Assessment,
  AssessmentQuestion,
  AssessmentAssignment,
  StudentAttempt,
  StudentAnswer,
  Feature,
  SchoolFeature,
  FeatureOverride,
};
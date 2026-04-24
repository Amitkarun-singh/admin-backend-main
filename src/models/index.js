/* =====================================================
   IMPORT ALL MODELS
   Associations are wired here and re-exported.
   Sync logic lives in src/index.js — never here.
   ===================================================== */
import User from "./user.model.js";
import AdminSchool from "./admin_school.model.js";

import StudentProfile from "./student_profile.model.js";
import TeacherProfile from "./teacher_profile.model.js";
import ParentProfile from "./parent_profile.model.js";

import ParentStudentMap from "./parent_student_map.model.js";
import StudentClassSection from "./student_class_section.model.js";
import StudentAnalytics from "./student_analytics.model.js";

import TeacherAnalytics from "./teacher_analytics.model.js";
import TeacherClassSectionSubject from "./teacher_class_section_subject.model.js";

import AdminRole from "./admin_role.model.js";
import AdminPermission from "./admin_permission.model.js";
import AdminRolePermission from "./admin_role_permission.model.js";

import AdminClass from "./admin_class.model.js";
import AdminSection from "./admin_section.model.js";
import AdminCourse from "./admin_course.model.js";
import AdminClassCourseMap from "./admin_class_course_map.model.js";

import AdminSubject from "./admin_subject_master.model.js";

import GiniLog from "./gini_log.model.js";
import TutorLog from "./Tutor_log.model.js";
import PracticeLog from "./practice_log.model.js";
import UserSession from "./user_session.model.js";

import Assessment from "./assessment.model.js";
import AssessmentQuestion from "./assessment_question.model.js";
import AssessmentAssignment from "./assessment_assignment.model.js";
import { StudentAttempt, StudentAnswer } from "./student_attempt.model.js"; 

import Feature         from "./feature.model.js";
import SchoolFeature   from "./school_feature.model.js";
import FeatureOverride from "./feature_overrides.model.js";

/* =====================================================
   USER ↔ ROLE  (RBAC)
   Define before User ↔ School so role_id FK is
   registered before other associations reference User.
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
   CLASS ↔ SECTION
   ===================================================== */
AdminClass.hasMany(AdminSection, { foreignKey: "class_id", as: "sections" });
AdminSection.belongsTo(AdminClass, { foreignKey: "class_id", as: "class" });

/* =====================================================
   CLASS ↔ COURSE  (Many-to-Many via AdminClassCourseMap)
   NOTE: AdminClassCourseMap only has class_id + course_id.
   The previous AdminSection ↔ AdminCourse through this
   table was wrong (section_id doesn't exist on the map)
   and has been removed.
   ===================================================== */
AdminClass.belongsToMany(AdminCourse, {
  through: AdminClassCourseMap,
  foreignKey: "class_id",
  otherKey: "course_id",
  as: "courses",
});
AdminCourse.belongsToMany(AdminClass, {
  through: AdminClassCourseMap,
  foreignKey: "course_id",
  otherKey: "class_id",
  as: "classes",
});

/* =====================================================
   COURSE ↔ SUBJECT MASTER
   ===================================================== */
AdminCourse.hasMany(AdminSubject, {
  foreignKey: "course_id",
  as: "subjects",
});
AdminSubject.belongsTo(AdminCourse, {
  foreignKey: "course_id",
  as: "course",
});

/* =====================================================
   STUDENT ↔ CLASS-SECTION
   ===================================================== */
StudentProfile.hasOne(StudentClassSection, {
  foreignKey: "student_id",
  as: "classSection",
});
StudentClassSection.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student",
});
AdminClass.hasMany(StudentClassSection, {
  foreignKey: "class_id",
  as: "studentAssignments",
});
StudentClassSection.belongsTo(AdminClass, {
  foreignKey: "class_id",
  as: "class",
});
AdminSection.hasMany(StudentClassSection, {
  foreignKey: "section_id",
  as: "studentAssignments",
});
StudentClassSection.belongsTo(AdminSection, {
  foreignKey: "section_id",
  as: "section",
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
   ===================================================== */
TeacherProfile.hasMany(TeacherClassSectionSubject, {
  foreignKey: "teacher_id",
  as: "assignments",
});
TeacherClassSectionSubject.belongsTo(TeacherProfile, {
  foreignKey: "teacher_id",
  as: "teacher",
});
AdminClass.hasMany(TeacherClassSectionSubject, {
  foreignKey: "class_id",
  as: "teacherAssignments",
});
TeacherClassSectionSubject.belongsTo(AdminClass, {
  foreignKey: "class_id",
  as: "class",
});
AdminSection.hasMany(TeacherClassSectionSubject, {
  foreignKey: "section_id",
  as: "teacherAssignments",
});
TeacherClassSectionSubject.belongsTo(AdminSection, {
  foreignKey: "section_id",
  as: "section",
});
AdminSubject.hasMany(TeacherClassSectionSubject, {
  foreignKey: "class_subject_id",
  as: "teacherAssignments",
});
TeacherClassSectionSubject.belongsTo(AdminSubject, {
  foreignKey: "class_subject_id",
  as: "subject",
});

/* =====================================================
   TEACHER PROFILE ↔ PRIMARY SUBJECT
   ===================================================== */
TeacherProfile.belongsTo(AdminSubject, {
  foreignKey: "primary_subject_id",
  as: "primarySubject",
});
AdminSubject.hasMany(TeacherProfile, {
  foreignKey: "primary_subject_id",
  as: "teachers",
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
   SUBJECT ↔ CLASS  (AdminSubject has class_id FK)
   ===================================================== */
AdminSubject.belongsTo(AdminClass, { foreignKey: "class_id", as: "class" });
AdminClass.hasMany(AdminSubject, { foreignKey: "class_id", as: "subjects" });

// USER ↔ USER SESSIONS
User.hasMany(UserSession, { foreignKey: "user_id", as: "sessions" });
UserSession.belongsTo(User, { foreignKey: "user_id", as: "user" });

// USER ↔ GINI LOGS
User.hasMany(GiniLog, { foreignKey: "user_id", as: "giniLogs" });
GiniLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

// USER ↔ PRACTICE LOGS
User.hasMany(PracticeLog, { foreignKey: "user_id", as: "practiceLogs" });
PracticeLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

// USER ↔ TUTOR LOGS
User.hasMany(TutorLog, { foreignKey: "user_id", as: "tutorLogs" });
TutorLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

/* =====================================================
   ASSESSMENT ENGINE ASSOCIATIONS  ← NEW
   ===================================================== */

/* Teacher (User) creates Assessments */
User.hasMany(Assessment, { foreignKey: "created_by", as: "assessments" });
Assessment.belongsTo(User, { foreignKey: "created_by", as: "creator" });

/* Assessment ↔ Questions */
Assessment.hasMany(AssessmentQuestion, {
  foreignKey: "assessment_id",
  as: "questions",
});
AssessmentQuestion.belongsTo(Assessment, {
  foreignKey: "assessment_id",
  as: "assessment",
});

/* Assessment ↔ Assignments */
Assessment.hasMany(AssessmentAssignment, {
  foreignKey: "assessment_id",
  as: "assignments",
});
AssessmentAssignment.belongsTo(Assessment, {
  foreignKey: "assessment_id",
  as: "assessment",
});

/* Assignment ↔ Attempts */
AssessmentAssignment.hasMany(StudentAttempt, {
  foreignKey: "assignment_id",
  as: "attempts",
});
StudentAttempt.belongsTo(AssessmentAssignment, {
  foreignKey: "assignment_id",
  as: "assignment",
});

/* Attempt ↔ Answers */
StudentAttempt.hasMany(StudentAnswer, {
  foreignKey: "attempt_id",
  as: "answers",
});
StudentAnswer.belongsTo(StudentAttempt, {
  foreignKey: "attempt_id",
  as: "attempt",
});

/* Answer ↔ Question (to fetch correct answer when reviewing) */
StudentAnswer.belongsTo(AssessmentQuestion, {
  foreignKey: "question_id",
  as: "question",
});

/* StudentProfile ↔ Attempts */
StudentProfile.hasMany(StudentAttempt, {
  foreignKey: "student_id",
  as: "attempts",
});
StudentAttempt.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student",
});

// --- ASSOCIATIONS (add after existing associations) ---

AdminSchool.hasMany(SchoolFeature,   { foreignKey: "school_id",  as: "schoolFeatures" });
SchoolFeature.belongsTo(AdminSchool, { foreignKey: "school_id",  as: "school" });
 
Feature.hasMany(SchoolFeature,       { foreignKey: "feature_id", as: "schoolGrants" });
SchoolFeature.belongsTo(Feature,     { foreignKey: "feature_id", as: "feature" });
 
// Feature.hasMany(FeatureOverride,     { foreignKey: "feature_id", as: "overrides" });
// FeatureOverride.belongsTo(Feature,   { foreignKey: "feature_id", as: "feature" });
 
// AdminSchool.hasMany(FeatureOverride,    { foreignKey: "school_id", as: "featureOverrides" });
// FeatureOverride.belongsTo(AdminSchool,  { foreignKey: "school_id", as: "school" });

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
  AdminClass,
  AdminSection,
  AdminCourse,
  AdminClassCourseMap,
  AdminSubject,
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

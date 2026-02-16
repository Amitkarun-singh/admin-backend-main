/* =====================================================
   IMPORT ALL MODELS
   ===================================================== */
import AdminUser from "./admin_user.model.js";
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

import AdminClassSubject from "./admin_class_subject.model.js";
import AdminSubjectMaster from "./admin_subject_master.model.js";


/* =====================================================
   SCHOOL ↔ USER
   ===================================================== */
AdminUser.belongsTo(AdminSchool, {
  foreignKey: "school_id",
  as: "school"
});

AdminSchool.hasMany(AdminUser, {
  foreignKey: "school_id",
  as: "users"
});


/* =====================================================
   USER ↔ STUDENT PROFILE
   ===================================================== */
AdminUser.hasOne(StudentProfile, {
  foreignKey: "user_id",
  as: "student"
});

StudentProfile.belongsTo(AdminUser, {
  foreignKey: "user_id",
  as: "user"
});


/* =====================================================
   USER ↔ TEACHER PROFILE
   ===================================================== */
AdminUser.hasOne(TeacherProfile, {
  foreignKey: "user_id",
  as: "teacher"
});

TeacherProfile.belongsTo(AdminUser, {
  foreignKey: "user_id",
  as: "user"
});


/* =====================================================
   USER ↔ PARENT PROFILE
   ===================================================== */
AdminUser.hasOne(ParentProfile, {
  foreignKey: "user_id",
  as: "parent"
});

ParentProfile.belongsTo(AdminUser, {
  foreignKey: "user_id",
  as: "user"
});


/* =====================================================
   PARENT ↔ STUDENT (Many-to-Many)
   ===================================================== */
ParentProfile.belongsToMany(StudentProfile, {
  through: ParentStudentMap,
  foreignKey: "parent_id",
  otherKey: "student_id",
  as: "students"
});

StudentProfile.belongsToMany(ParentProfile, {
  through: ParentStudentMap,
  foreignKey: "student_id",
  otherKey: "parent_id",
  as: "parents"
});


/* =====================================================
   STUDENT ↔ CLASS-SECTION
   ===================================================== */
StudentProfile.hasOne(StudentClassSection, {
  foreignKey: "student_id",
  as: "classSection"
});

StudentClassSection.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student"
});

AdminClass.hasMany(StudentClassSection, {
  foreignKey: "class_id",
  as: "students"
});

AdminSection.hasMany(StudentClassSection, {
  foreignKey: "section_id",
  as: "students"
});


/* =====================================================
   STUDENT ANALYTICS
   ===================================================== */
StudentProfile.hasOne(StudentAnalytics, {
  foreignKey: "student_id",
  as: "analytics"
});

StudentAnalytics.belongsTo(StudentProfile, {
  foreignKey: "student_id",
  as: "student"
});


/* =====================================================
   TEACHER ANALYTICS
   ===================================================== */
TeacherProfile.hasOne(TeacherAnalytics, {
  foreignKey: "teacher_id",
  as: "analytics"
});

TeacherAnalytics.belongsTo(TeacherProfile, {
  foreignKey: "teacher_id",
  as: "teacher"
});


/* =====================================================
   TEACHER ↔ CLASS-SECTION-SUBJECT
   ===================================================== */
TeacherProfile.hasMany(TeacherClassSectionSubject, {
  foreignKey: "teacher_id",
  as: "assignments"
});

TeacherClassSectionSubject.belongsTo(TeacherProfile, {
  foreignKey: "teacher_id",
  as: "teacher"
});

AdminClass.hasMany(TeacherClassSectionSubject, {
  foreignKey: "class_id",
  as: "teacherAssignments"
});

AdminSection.hasMany(TeacherClassSectionSubject, {
  foreignKey: "section_id",
  as: "teacherAssignments"
});

AdminClassSubject.hasMany(TeacherClassSectionSubject, {
  foreignKey: "class_subject_id",
  as: "teacherAssignments"
});


/* =====================================================
   CLASS ↔ SECTION
   ===================================================== */
AdminClass.hasMany(AdminSection, {
  foreignKey: "class_id",
  as: "sections"
});

AdminSection.belongsTo(AdminClass, {
  foreignKey: "class_id",
  as: "class"
});


/* =====================================================
   CLASS ↔ COURSE (Many-to-Many)
   ===================================================== */
AdminClass.belongsToMany(AdminCourse, {
  through: AdminClassCourseMap,
  foreignKey: "class_id",
  otherKey: "course_id",
  as: "courses"
});

AdminCourse.belongsToMany(AdminClass, {
  through: AdminClassCourseMap,
  foreignKey: "course_id",
  otherKey: "class_id",
  as: "classes"
});


/* =====================================================
   CLASS SUBJECT ↔ SUBJECT MASTER
   ===================================================== */
AdminClassSubject.belongsTo(AdminSubjectMaster, {
  foreignKey: "subject_id",
  as: "subject"
});

AdminSubjectMaster.hasMany(AdminClassSubject, {
  foreignKey: "subject_id",
  as: "classSubjects"
});


/* =====================================================
   USER ↔ ROLE (RBAC)
   ===================================================== */
AdminUser.belongsTo(AdminRole, {
  foreignKey: "role_id",
  as: "role"
});

AdminRole.hasMany(AdminUser, {
  foreignKey: "role_id",
  as: "users"
});


/* =====================================================
   ROLE ↔ PERMISSIONS (Many-to-Many)
   ===================================================== */
AdminRole.belongsToMany(AdminPermission, {
  through: AdminRolePermission,
  foreignKey: "role_id",
  otherKey: "permission_id",
  as: "permissions"
});

AdminPermission.belongsToMany(AdminRole, {
  through: AdminRolePermission,
  foreignKey: "permission_id",
  otherKey: "role_id",
  as: "roles"
});


/* =====================================================
   EXPORT ALL MODELS
   ===================================================== */
export {
  AdminUser,
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

  AdminClassSubject,
  AdminSubjectMaster
};

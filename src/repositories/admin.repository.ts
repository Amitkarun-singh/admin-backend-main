import User from "../models/user.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminRole from "../models/admin_role.model.js";
import AdminPermission from "../models/admin_permission.model.ts";
import AdminRolePermission from "../models/admin_role_permission.model.js";
import StudentProfile from "../models/student_profile.model.js";
import ParentProfile from "../models/parent_profile.model.js";
import TeacherProfile from "../models/teacher_profile.model.js";

// ─────────────────────────────────────────────
// SCHOOL
// ─────────────────────────────────────────────
export const findSchoolById = (school_id: number) =>
    AdminSchool.findOne({ where: { school_id } });

export const updateSchoolById = async (school_id: number, updates: object) => {
    const school = await findSchoolById(school_id);
    if (!school) return null;
    return school.update(updates);
};

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────
export const findUserById = (user_id: number) =>
    User.findOne({ where: { user_id } });

export const updateUserById = async (user_id: number, updates: object) => {
    const user = await findUserById(user_id);
    if (!user) return null;
    return user.update(updates);
};

export const saveUserRoleChange = async (user_id: number, role_id: number) => {
    const user = await findUserById(user_id);
    if (!user) return null;
    user.role_id = role_id;
    return user.save();
};

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────
export const findAllRoles = () =>
    AdminRole.findAll();

export const findRoleById = (role_id: number) =>
    AdminRole.findOne({ where: { role_id } });

export const createRole = (role_name: string, description?: string) =>
    AdminRole.create({ role_name, description });

export const findAllRolesWithPermissions = () =>
    AdminRole.findAll({
        include: [
            {
                model: AdminPermission,
                as: "permissions",
                attributes: ["permission_id", "permission_key"],
            },
        ],
    });

// ─────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────
export const findAllPermissions = () =>
    AdminPermission.findAll();

export const createPermission = (permission_key: string, description?: string) =>
    AdminPermission.create({ permission_key, description });

// ─────────────────────────────────────────────
// ROLE ↔ PERMISSION MAPPING
// ─────────────────────────────────────────────
export const removePermissionsFromRole = (role_id: number) =>
    AdminRolePermission.destroy({ where: { role_id } });

export const bulkAssignPermissions = (
    role_id: number,
    permission_ids: number[],
) =>
    AdminRolePermission.bulkCreate(
        permission_ids.map((permission_id) => ({ role_id, permission_id })),
    );

// ─────────────────────────────────────────────
// PROFILE LOOKUPS
// ─────────────────────────────────────────────
export const findStudentByUserId = (user_id: number) =>
    StudentProfile.findOne({ where: { user_id } });

export const findTeacherByUserId = (user_id: number) =>
    TeacherProfile.findOne({ where: { user_id } });

export const findParentByUserId = (user_id: number) =>
    ParentProfile.findOne({ where: { user_id } });
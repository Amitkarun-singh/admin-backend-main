import { AppError } from "../error/AppError.js";
import {
    NotFoundError,
    ValidationError,
    AuthenticationError,
} from "../error/subError.js";

import * as AdminRepo from "../repositories/admin.repository.js";

// ─────────────────────────────────────────────
// SCHOOL
// ─────────────────────────────────────────────
export const updateSchoolService = async (
    school_id: number,
    updates: object,
) => {
    const school = await AdminRepo.findSchoolById(school_id);
    if (!school) throw new NotFoundError("School", String(school_id));

    return school.update(updates);
};

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────
export const getAllRolesService = () =>
    AdminRepo.findAllRoles();

export const createRoleService = async (
    role_name: string,
    description?: string,
) => {
    if (!role_name) {
        throw new ValidationError([
            { field: "role_name", message: "Role name is required", code: "REQUIRED" },
        ]);
    }
    return AdminRepo.createRole(role_name, description);
};

export const getRolesWithPermissionsService = () =>
    AdminRepo.findAllRolesWithPermissions();

// ─────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────
export const getAllPermissionsService = () =>
    AdminRepo.findAllPermissions();

export const createPermissionService = async (
    permission_key: string,
    description?: string,
) => {
    if (!permission_key) {
        throw new ValidationError([
            {
                field: "permission_key",
                message: "Permission key is required",
                code: "REQUIRED",
            },
        ]);
    }
    return AdminRepo.createPermission(permission_key, description);
};

// ─────────────────────────────────────────────
// ASSIGN PERMISSIONS TO ROLE
// ─────────────────────────────────────────────
export const assignPermissionsToRoleService = async (
    role_id: number,
    permission_ids: number[],
) => {
    if (!role_id || !permission_ids?.length) {
        throw new ValidationError([
            ...(!role_id
                ? [{ field: "role_id", message: "Role is required", code: "REQUIRED" }]
                : []),
            ...(!permission_ids?.length
                ? [
                      {
                          field: "permission_ids",
                          message: "Permissions are required",
                          code: "REQUIRED",
                      },
                  ]
                : []),
        ]);
    }

    await AdminRepo.removePermissionsFromRole(role_id);
    return AdminRepo.bulkAssignPermissions(role_id, permission_ids);
};

// ─────────────────────────────────────────────
// CHANGE USER ROLE
// ─────────────────────────────────────────────
export const changeUserRoleService = async (
    user_id: number,
    role_id: number,
) => {
    if (!user_id || !role_id) {
        throw new ValidationError([
            ...(!user_id
                ? [{ field: "user_id", message: "User is required", code: "REQUIRED" }]
                : []),
            ...(!role_id
                ? [{ field: "role_id", message: "Role is required", code: "REQUIRED" }]
                : []),
        ]);
    }

    const user = await AdminRepo.findUserById(user_id);
    if (!user) throw new NotFoundError("User", String(user_id));

    return AdminRepo.saveUserRoleChange(user_id, role_id);
};

// ─────────────────────────────────────────────
// EDIT USER PROFILE
// ─────────────────────────────────────────────
export const editProfileService = async (
    requestorRole: string,
    user_id: number,
    updates: Record<string, any>,
) => {
    // 🔐 Only ADMIN / SUBADMIN allowed
    if (!["ADMIN", "SUBADMIN"].includes(requestorRole)) {
        throw new AuthenticationError("Access denied");
    }

    if (!user_id) {
        throw new ValidationError([
            { field: "user_id", message: "user_id is required", code: "REQUIRED" },
        ]);
    }

    const user = await AdminRepo.findUserById(user_id);
    if (!user) throw new NotFoundError("User", String(user_id));

    // Resolve role name from DB
    const roleData = await AdminRepo.findRoleById(user.role_id);
    const userRole = roleData?.role_name;

    // ✅ Always update common USER TABLE fields
    await user.update({
        full_name:    updates.full_name    ?? user.full_name,
        email:        updates.email        ?? user.email,
        phone_number: updates.phone_number ?? user.phone_number,
        status:       updates.status       ?? user.status,
    });

    // 🔹 ADMIN / SUBADMIN — user table only
    if (["ADMIN", "SUBADMIN"].includes(userRole ?? "")) {
        return user;
    }

    // 🔹 STUDENT
    if (userRole === "STUDENT") {
        const student = await AdminRepo.findStudentByUserId(user_id);
        if (!student) throw new NotFoundError("Student", String(user_id));

        return student.update({
            preferred_language: updates.preferred_language ?? student.preferred_language,
            dob:                updates.dob                ?? student.dob,
            gender:             updates.gender             ?? student.gender,
            analytics_enabled:  updates.analytics_enabled  ?? student.analytics_enabled,
            status:             updates.profile_status     ?? student.status,
        });
    }

    // 🔹 TEACHER
    if (userRole === "TEACHER") {
        const teacher = await AdminRepo.findTeacherByUserId(user_id);
        if (!teacher) throw new NotFoundError("Teacher", String(user_id));

        return teacher.update({
            experience:  updates.experience    ?? teacher.experience,
            age:         updates.age           ?? teacher.age,
            device_type: updates.device_type   ?? teacher.device_type,
            cost_limit:  updates.cost_limit    ?? teacher.cost_limit,
            status:      updates.profile_status ?? teacher.status,
        });
    }

    // 🔹 PARENT
    if (userRole === "PARENT") {
        const parent = await AdminRepo.findParentByUserId(user_id);
        if (!parent) throw new NotFoundError("Parent", String(user_id));

        return parent.update({
            relation: updates.relation ?? parent.relation,
        });
    }

    throw new AppError({
        statusCode: 400,
        type: "UNSUPPORTED_ROLE",
        message: "Unsupported role",
    });
};

// ─────────────────────────────────────────────
// CHANGE USER STATUS
// ─────────────────────────────────────────────
export const changeStatusService = async (
    requestorRole: string,
    user_id: number,
    status: string,
) => {
    // 🔐 Only ADMIN allowed
    if (!["ADMIN"].includes(requestorRole)) {
        throw new AuthenticationError("Access denied");
    }

    if (!user_id || !status) {
        throw new ValidationError([
            ...(!user_id
                ? [{ field: "user_id", message: "user_id is required", code: "REQUIRED" }]
                : []),
            ...(!status
                ? [{ field: "status", message: "status is required", code: "REQUIRED" }]
                : []),
        ]);
    }

    const user = await AdminRepo.findUserById(user_id);
    if (!user) throw new NotFoundError("User", String(user_id));

    const roleData = await AdminRepo.findRoleById(user.role_id);
    const userRole = roleData?.role_name;

    // ✅ Always update user table
    await user.update({ status });

    // ✅ Mirror status to profile table
    if (userRole === "STUDENT") {
        const student = await AdminRepo.findStudentByUserId(user_id);
        if (student) await student.update({ status });
    } else if (userRole === "TEACHER") {
        const teacher = await AdminRepo.findTeacherByUserId(user_id);
        if (teacher) await teacher.update({ status });
    } else if (userRole === "PARENT") {
        const parent = await AdminRepo.findParentByUserId(user_id);
        if (parent) await parent.update({});  // ParentProfile has no status column
    }
    // ADMIN / SUBADMIN → user table already updated

    return {};
};
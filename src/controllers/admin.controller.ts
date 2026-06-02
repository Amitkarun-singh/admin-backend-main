import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import * as AdminService from "../services/admin.service.ts";

// ─────────────────────────────────────────────
// SCHOOL
// ─────────────────────────────────────────────
export const updateSchool = asyncHandler(async (req, res) => {
    const { school_id } = req.user;
    const school = await AdminService.updateSchoolService(school_id, req.body);

    return res
        .status(200)
        .json(new ApiResponse(200, school, "School updated successfully"));
});

// ─────────────────────────────────────────────
// ROLES
// ─────────────────────────────────────────────
export const getAllRoles = asyncHandler(async (_req, res) => {
    const roles = await AdminService.getAllRolesService();

    return res
        .status(200)
        .json(new ApiResponse(200, roles, "Roles fetched successfully"));
});

export const createRole = asyncHandler(async (req, res) => {
    const { role_name, description } = req.body;
    const role = await AdminService.createRoleService(role_name, description);

    return res
        .status(201)
        .json(new ApiResponse(201, role, "Role created successfully"));
});

export const getRolesWithPermissions = asyncHandler(
    async (_req, res) => {
        const roles = await AdminService.getRolesWithPermissionsService();

        return res
            .status(200)
            .json(
                new ApiResponse(200, roles, "Roles with permissions fetched successfully"),
            );
    },
);

// ─────────────────────────────────────────────
// PERMISSIONS
// ─────────────────────────────────────────────
export const getAllPermissions = asyncHandler(
    async (_req, res) => {
        const permissions = await AdminService.getAllPermissionsService();

        return res
            .status(200)
            .json(new ApiResponse(200, permissions, "Permissions fetched successfully"));
    },
);

export const createPermission = asyncHandler(
    async (req, res) => {
        const { permission_key, description } = req.body;
        const permission = await AdminService.createPermissionService(
            permission_key,
            description,
        );

        return res
            .status(201)
            .json(new ApiResponse(201, permission, "Permission created successfully"));
    },
);

// ─────────────────────────────────────────────
// ASSIGN PERMISSIONS TO ROLE
// ─────────────────────────────────────────────
export const assignPermissionsToRole = asyncHandler(
    async (req, res) => {
        const { role_id, permission_ids } = req.body;
        await AdminService.assignPermissionsToRoleService(role_id, permission_ids);

        return res
            .status(200)
            .json(
                new ApiResponse(200, {}, "Permissions assigned to role successfully"),
            );
    },
);

// ─────────────────────────────────────────────
// CHANGE USER ROLE
// ─────────────────────────────────────────────
export const changeUserRole = asyncHandler(
    async (req, res) => {
        const { user_id, role_id } = req.body;
        const user = await AdminService.changeUserRoleService(user_id, role_id);

        return res
            .status(200)
            .json(new ApiResponse(200, user, "User role updated successfully"));
    },
);

// ─────────────────────────────────────────────
// EDIT PROFILE
// ─────────────────────────────────────────────
export const editProfile = asyncHandler(async (req, res) => {
    const { role } = req.user;
    const { user_id, ...updates } = req.body;

    const updatedData = await AdminService.editProfileService(role, user_id, updates);

    return res
        .status(200)
        .json(new ApiResponse(200, updatedData, "Profile updated successfully"));
});

// ─────────────────────────────────────────────
// CHANGE USER STATUS
// ─────────────────────────────────────────────
export const changeStatus = asyncHandler(async (req, res) => {
    const { role } = req.user;
    const { user_id, status } = req.body;

    await AdminService.changeStatusService(role, user_id, status);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "User status updated successfully"));
});
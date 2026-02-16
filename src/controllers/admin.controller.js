import AdminUser from "../models/admin_user.model.js";
import AdminSchool from "../models/admin_school.model.js";
import AdminRole from "../models/admin_role.model.js";
import AdminPermission from "../models/admin_permission.model.js";
import AdminRolePermission from "../models/admin_role_permission.model.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// UPDATE SCHOOL DETAILS
const updateSchool = asyncHandler(async (req, res) => {
    const { school_id } = req.user;
    const updates = req.body;

    const school = await AdminSchool.findOne({
        where: { school_id },
    });

    if (!school) throw new ApiError(404, "School not found");

    await school.update(updates);

    return res
        .status(200)
        .json(new ApiResponse(200, school, "School updated successfully"));
});

// GET ALL ROLES
const getAllRoles = asyncHandler(async (req, res) => {
    const roles = await AdminRole.findAll();

    return res
        .status(200)
        .json(new ApiResponse(200, roles, "Roles fetched successfully"));
});


// CREATE ROLE
const createRole = asyncHandler(async (req, res) => {
    const { role_name, description } = req.body;

    if (!role_name) throw new ApiError(400, "Role name is required");

    const role = await AdminRole.create({
        role_name,
        description,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, role, "Role created successfully"));
});


// GET ALL PERMISSIONS
const getAllPermissions = asyncHandler(async (req, res) => {
    const permissions = await AdminPermission.findAll();

    return res
        .status(200)
        .json(
        new ApiResponse(200, permissions, "Permissions fetched successfully"),
        );
});


// CREATE PERMISSION
const createPermission = asyncHandler(async (req, res) => {
    const { permission_key, description } = req.body;

    if (!permission_key) throw new ApiError(400, "Permission key is required");

    const permission = await AdminPermission.create({
        permission_key,
        description,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, permission, "Permission created successfully"));
});

// ASSIGN PERMISSIONS TO ROLE
const assignPermissionsToRole = asyncHandler(async (req, res) => {
    const { role_id, permission_ids } = req.body;

    if (!role_id || !permission_ids)
        throw new ApiError(400, "Role and permissions required");

    // Remove old permissions
    await AdminRolePermission.destroy({
        where: { role_id },
    });

    // Add new permissions
    const records = permission_ids.map((permission_id) => ({
        role_id,
        permission_id,
    }));

    await AdminRolePermission.bulkCreate(records);

    return res
        .status(200)
        .json(
        new ApiResponse(200, {}, "Permissions assigned to role successfully"),
        );
});

// CHANGE USER ROLE
const changeUserRole = asyncHandler(async (req, res) => {
    const { user_id, role_id } = req.body;

    if (!user_id || !role_id) throw new ApiError(400, "User and role required");

    const user = await AdminUser.findOne({
        where: { user_id },
    });

    if (!user) throw new ApiError(404, "User not found");

    user.role_id = role_id;
    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User role updated successfully"));
});

// GET ROLES WITH PERMISSIONS
const getRolesWithPermissions = asyncHandler(async (req, res) => {
    const roles = await AdminRole.findAll({
        include: [
        {
            model: AdminPermission,
            as: "permissions",
            attributes: ["permission_id", "permission_key"]
        }
        ]
    });

    return res.status(200).json(
        new ApiResponse(
        200,
        roles,
        "Roles with permissions fetched successfully"
        )
    );
});

export {
    updateSchool,
    getAllRoles,
    createRole,
    getAllPermissions,
    createPermission,
    assignPermissionsToRole,
    changeUserRole,
    getRolesWithPermissions,
};

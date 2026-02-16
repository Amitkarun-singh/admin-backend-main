import { ApiError } from "../utils/ApiError.js";

export const requirePermission = (permission) => {
    return (req, res, next) => {
        const userPermissions = req.user?.permissions || [];

        if (!userPermissions.includes(permission)) {
        throw new ApiError(403, "Access denied");
        }

        next();
    };
};

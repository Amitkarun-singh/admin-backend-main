import { ApiError } from "../utils/ApiError.js";

export const allowRoles = (...roles) => {
    return (req, res, next) => {
        const userRole = req.user?.role;

        if (!roles.includes(userRole)) {
        throw new ApiError(403, "Access denied");
        }

        next();
    };
};

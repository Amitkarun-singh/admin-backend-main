import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "Access token missing");
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
        token,
        process.env.ACCESS_TOKEN_SECRET
        );

        req.user = decoded;
        next();
    } catch (error) {
        throw new ApiError(401, "Invalid or expired token");
    }
};

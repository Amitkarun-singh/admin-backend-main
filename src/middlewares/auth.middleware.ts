import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import type { Request, Response, NextFunction } from "express";
import type { UserTokenPayload } from "../type/type.js";

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log("Auth middleware");
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Auth middleware Access token missing");
    throw new ApiError(401, "Access token missing");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as UserTokenPayload;

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware |Invalid or expired token ", error);
    throw new ApiError(401, "Invalid or expired token");
  }
};

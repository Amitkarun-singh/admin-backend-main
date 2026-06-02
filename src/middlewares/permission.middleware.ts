import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ApiError } from "../utils/ApiError.ts";

export const requirePermission = (permission: string): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const userPermissions: string[] = req.user?.permissions ?? [];

    if (!userPermissions.includes(permission)) {
      throw new ApiError(403, "Access denied");
    }

    next();
  };
};
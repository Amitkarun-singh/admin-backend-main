import type { Request, Express } from "express";
import type { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      user: UserTokenPayload;
    }
  }
}

type File = Express.Multer.File;

interface UserTokenPayload extends JwtPayload {
  user_id: number;
  role: string;
  permissions: string[];
  school_id: number;
  iat: number;
  exp: number;
}

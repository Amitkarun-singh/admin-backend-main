
import profileService from "../services/profile.service.js";
import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ValidationError } from "../error/subError.ts";

export const getUserProfile = async (req: Request, res: Response) => {
  const { user_id, role, school_id } = req.user;

  const profileData = await profileService.getUserProfile(user_id, role, school_id);

  return res.status(200).json(new ApiResponse(200, profileData, "Profile fetched"));

}

export async function updateAvatar(req: Request, res: Response) {
  const { user_id } = req.user;
  const file = req.file;

  if (!file) throw new ValidationError([{
    field: "file",
    message: "File required",
    code: "FILE_REQUIRED"
  }]);

  const avatar = await profileService.updateAvatar(user_id.toString(), file);

  return res.status(200).json(new ApiResponse(200, { avatar }, "Avatar updated"));
}


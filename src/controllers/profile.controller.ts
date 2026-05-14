
import profileService from "../services/profile.service.js";
import type { Request, Response } from "express";
import { ApiResponse } from "../utils/ApiResponse.js";

export const getUserProfile = async (req: Request, res: Response) => {
  const { user_id, role, school_id } = req.user;

  const profileData = await profileService.getUserProfile(user_id, role, school_id);

  return res.status(200).json(new ApiResponse(200, profileData, "Profile fetched"));

}


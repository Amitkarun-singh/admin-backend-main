import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { parentService } from "../services/parent.service.js";

export const createParent = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const parent = await parentService.createParent({ ...req.body, school_id });
  return res.status(201).json(new ApiResponse(201, parent, "Parent created successfully"));
});

export const getAllParents = asyncHandler(async (req: Request, res: Response) => {
  const school_id = (req as any).user.school_id;
  const parents = await parentService.getAllParents(school_id);
  return res.status(200).json(new ApiResponse(200, parents, "Parents fetched"));
});

export const getParentById = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parent = await parentService.getParentById(id);
  return res.status(200).json(new ApiResponse(200, parent, "Parent fetched"));
});

export const getParentProfile = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parent = await parentService.getParentProfile(id);
  return res.status(200).json(new ApiResponse(200, parent, "Parent profile fetched"));
});

export const updateParent = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parent = await parentService.updateParent(id, req.body);
  return res.status(200).json(new ApiResponse(200, parent, "Parent updated successfully"));
});

export const deleteParent = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await parentService.deleteParent(id);
  return res.status(200).json(new ApiResponse(200, null, "Parent deleted successfully"));
});
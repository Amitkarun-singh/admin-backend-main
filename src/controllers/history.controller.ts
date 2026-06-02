import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { historyService } from "../services/history.service.js";

export const recordSession = async ({ user_id, ua, ip }: { user_id: number; ua: string; ip: string }): Promise<void> => {
  return historyService.recordSession({ user_id, ua, ip });
};

export const closeSession = async (user_id: number): Promise<void> => {
  return historyService.closeSession(user_id);
};

export const getRecentQueries = asyncHandler(async (req: Request, res: Response) => {
  const user_id = Number((req as any).user.user_id);
  const limit   = parseInt(req.query.limit as string) || 20;

  const combined = await historyService.getRecentQueries(user_id, limit);
  return res.status(200).json(new ApiResponse(200, combined, "Recent queries fetched"));
});

export const getFeaturesExplored = asyncHandler(async (req: Request, res: Response) => {
  const user_id = Number((req as any).user.user_id);
  const features = await historyService.getFeaturesExplored(user_id);
  return res.status(200).json(new ApiResponse(200, features, "Features explored fetched"));
});

export const getLoginHistory = asyncHandler(async (req: Request, res: Response) => {
  const user_id = Number((req as any).user.user_id);
  const limit   = parseInt(req.query.limit as string) || 10;

  const history = await historyService.getLoginHistory(user_id, limit);
  return res.status(200).json(new ApiResponse(200, history, "Login history fetched"));
});

export const getWeekActivity = asyncHandler(async (req: Request, res: Response) => {
  const user_id = Number((req as any).user.user_id);
  const result  = await historyService.getWeekActivity(user_id);
  return res.status(200).json(new ApiResponse(200, result, "Week activity fetched"));
});

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const user_id = Number((req as any).user.user_id);
  const stats   = await historyService.getStats(user_id);
  return res.status(200).json(new ApiResponse(200, stats, "Stats fetched"));
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  const user_id          = Number((req as any).user.user_id);
  const { conversation_id } = req.params;
  const source              = (req.query.source as string || "gini").toLowerCase();

  const result = await historyService.getConversation(user_id, conversation_id, source);
  return res.status(200).json(new ApiResponse(200, result, "Conversation fetched"));
});

export const getLatestTests = asyncHandler(async (req: Request, res: Response) => {
  const user_id    = Number((req as any).user.user_id);
  const student_id = user_id;

  const results = await historyService.getLatestTests(student_id);
  return res.status(200).json(new ApiResponse(200, results, "Latest tests fetched"));
});
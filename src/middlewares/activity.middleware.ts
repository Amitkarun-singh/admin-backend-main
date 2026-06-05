import type { Request, Response, NextFunction } from "express";
import UserStreak from "../models/user_streak.model.ts";
import { todayIST, calcStreak } from "../utils/streak.util.ts";

const _seenToday = new Set<string>();

export const activityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Must run after authMiddleware — if no user, skip silently
  const user_id = req.user?.user_id;
  if (!user_id) return next();

  const today = todayIST();
  const cacheKey = `${user_id}:${today}`;

  // Already processed this user today — skip without any DB call
  if (_seenToday.has(cacheKey)) return next();

  // Fire-and-forget: don't await, don't block the response
  _updateStreakBackground(Number(user_id), today, cacheKey).catch(() => {
    /* silently ignore */
  });

  return next();
};

async function _updateStreakBackground(
  user_id: number,
  today: string,
  cacheKey: string
): Promise<void> {
  try {
    const row = await UserStreak.findOne({ where: { user_id } });
    const update = calcStreak(row, today);

    if (!update) {
      // Already active today in DB — just mark cache
      _seenToday.add(cacheKey);
      return;
    }

    if (row) {
      await row.update(update);
    } else {
      await UserStreak.create({ user_id: BigInt(user_id), ...update });
    }

    _seenToday.add(cacheKey);

    console.log(
      `[Activity] user ${user_id} → current_streak=${update.current_streak}, ` +
        `longest_streak=${update.longest_streak}, date=${update.last_active_date}`
    );
  } catch (err) {
    // Non-fatal — never crash a request over streak tracking
    console.error(
      `[Activity] streak update failed for user ${user_id}:`,
      (err as Error).message
    );
  }
}

export function clearActivityCache(): void {
  _seenToday.clear();
  console.log("[Activity] Daily cache cleared");
}
import type { Request, Response, NextFunction, RequestHandler } from "express";
import NodeCache from "node-cache";

// 1 day TTL = 86400 seconds
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

const RATE_LIMIT = Number(process.env.RATE_LIMIT); // requests per day

export const rateLimit =
  (feature: string): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user.user_id;
      const key = `${feature}:${userId}`;

      const requestCount = cache.get<number>(key);

      if (requestCount === undefined) {
        // First request of the day
        cache.set(key, 1);
        return next();
      }

      if (requestCount >= RATE_LIMIT) {
        return void res.status(429).json({
          message: "Daily rate limit exceeded",
        });
      }

      // Increment count
      cache.set(key, requestCount + 1);

      next();
    } catch (err) {
      console.error("Rate limit error:", err);
      next();
    }
  };
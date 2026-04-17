import NodeCache from "node-cache";

// 1 day TTL = 86400 seconds
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

const RATE_LIMIT = process.env.RATE_LIMIT; // requests per day

export const rateLimit = (feature) => (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const key = `${feature}:${userId}`;

    let requestCount = cache.get(key);

    if (!requestCount) {
      // First request of the day
      cache.set(key, 1);
      return next();
    }

    if (requestCount >= RATE_LIMIT) {
      return res.status(429).json({
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

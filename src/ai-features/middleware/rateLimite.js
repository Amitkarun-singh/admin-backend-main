import NodeCache from "node-cache";

// 1 day TTL = 86400 seconds
const cache = new NodeCache({ stdTTL: 86400, checkperiod: 120 });

const RATE_LIMIT = 100; // requests per day

export async function rateLimit(req, res, next) {
  try {
    // const userId = req.user.id;
    const userId = req.body.id;
    const key = `rate:user:${userId}`;
    // const ttlMs = cache.getTtl(key);
    // const ttlSeconds = Math.ceil((ttlMs - Date.now()) / 1000);
    // console.log(ttlSeconds);
    // Get current request count
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
}

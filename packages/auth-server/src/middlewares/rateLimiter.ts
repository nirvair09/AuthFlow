import rateLimit from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { Redis } from "ioredis";

/**
 * Creates a rate limiter middleware using Redis for distributed rate limiting.
 */
export const createRateLimiter = (redis: Redis, { 
    windowMs, 
    max, 
    message 
}: { 
    windowMs: number; 
    max: number; 
    message: string 
}) => {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: { error: message },
        store: process.env.USE_REDIS_MOCK === "true" 
            ? undefined // Fallback to memory store
            : new RedisStore({
                // @ts-expect-error - ioredis and redis types may conflict but it works at runtime
                sendCommand: (...args: string[]) => redis.call(...args),
            }),

    });
};

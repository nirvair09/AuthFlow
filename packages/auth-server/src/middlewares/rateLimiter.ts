import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { getRedisClient } from "../redisHelper";

export const createRateLimiter = () => {
  const redisClient = getRedisClient();
  return rateLimit({
    store: new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 15 * 60 * 1000, 
    max: 100, 
    standardHeaders: true, 
    legacyHeaders: false, 
    message: { error: "Too many requests from this IP, please try again after 15 minutes" },
  });
};

export const createStrictRateLimiter = () => {
    const redisClient = getRedisClient();
  return rateLimit({
    store: new RedisStore({
      // @ts-ignore
      sendCommand: (...args: string[]) => redisClient.call(...args),
    }),
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many attempts from this IP, please try again after 15 minutes" },
  });
};

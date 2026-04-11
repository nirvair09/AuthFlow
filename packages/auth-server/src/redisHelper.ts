import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

let redisClient: Redis;

export const connectRedis = () => {
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    console.log("Connected to Redis");
    return redisClient;
};

export const getRedisClient = () => {
    if (!redisClient) {
        throw new Error("Redis client not initialized. Call connectRedis first.");
    }
    return redisClient;
};

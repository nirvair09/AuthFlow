"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = require("rate-limit-redis");
/**
 * Creates a rate limiter middleware using Redis for distributed rate limiting.
 */
const createRateLimiter = (redis, { windowMs, max, message }) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
        legacyHeaders: false, // Disable the `X-RateLimit-*` headers
        message: { error: message },
        store: new rate_limit_redis_1.RedisStore({
            // @ts-expect-error - ioredis and redis types may conflict but it works at runtime
            sendCommand: (...args) => redis.call(...args),
        }),
    });
};
exports.createRateLimiter = createRateLimiter;

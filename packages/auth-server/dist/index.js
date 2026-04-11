"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const ioredis_1 = __importDefault(require("ioredis"));
const auth_1 = __importDefault(require("./routes/auth"));
const jwks_1 = require("./jwks");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./utils/metrics");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use(logger_1.httpLogger);
app.use((0, cors_1.default)({
    origin: "http://localhost:3000", // Adjust as needed
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes will be mounted in startServer after Redis and Rate Limiters are initialized.
app.get("/", (req, res) => {
    res.send("Auth Flow Server is running with Observability");
});
app.get("/metrics", async (req, res) => {
    res.set("Content-Type", metrics_1.register.contentType);
    res.end(await metrics_1.register.metrics());
});
async function startServer() {
    try {
        // Connect to MongoDB
        if (process.env.MONGO_URI) {
            await mongoose_1.default.connect(process.env.MONGO_URI);
            logger_1.logger.info("Connected to MongoDB");
        }
        else {
            logger_1.logger.warn("MONGO_URI not found in .env");
        }
        // Connect to Redis
        const redis = new ioredis_1.default(process.env.REDIS_URL || "redis://localhost:6379");
        app.set("redis", redis);
        logger_1.logger.info("Connected to Redis");
        // Rate Limiting
        const { createRateLimiter } = await Promise.resolve().then(() => __importStar(require("./middlewares/rateLimiter")));
        const globalRateLimiter = createRateLimiter(redis, {
            windowMs: 60 * 1000, // 1 minute
            max: 100,
            message: "Too many requests, please try again later."
        });
        const authRateLimiter = createRateLimiter(redis, {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 5,
            message: "Too many login attempts, please try again after 15 minutes."
        });
        app.use(globalRateLimiter);
        app.set("authRateLimiter", authRateLimiter);
        app.use("/v1/auth/sign-in", authRateLimiter);
        app.use("/v1/auth", auth_1.default);
        // Start Background Workers
        const { startAuthWorker } = await Promise.resolve().then(() => __importStar(require("./queues/auth.queue")));
        startAuthWorker();
        // Generate JWK Pair
        const jwkPair = await (0, jwks_1.generateJWKPair)();
        app.set("jwkPair", jwkPair);
        logger_1.logger.info("Generated JWK Pair");
        const server = app.listen(PORT, () => {
            logger_1.logger.info(`Auth Flow Server is running on port ${PORT}`);
        });
        // Graceful Shutdown
        const shutdown = async () => {
            logger_1.logger.info("Shutting down gracefully...");
            server.close(async () => {
                logger_1.logger.info("HTTP server closed.");
                await mongoose_1.default.connection.close();
                logger_1.logger.info("MongoDB connection closed.");
                await redis.quit();
                logger_1.logger.info("Redis connection closed.");
                process.exit(0);
            });
            // If server doesn't close in 10s, force close
            setTimeout(() => {
                logger_1.logger.error("Could not close connections in time, forcefully shutting down");
                process.exit(1);
            }, 10000);
        };
        process.on("SIGTERM", shutdown);
        process.on("SIGINT", shutdown);
    }
    catch (error) {
        logger_1.logger.error(error, "Failed to start server:");
        process.exit(1);
    }
}
startServer();

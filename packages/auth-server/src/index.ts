import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import authRoutes from "./routes/auth";
import { generateJWKPair } from "./jwks";
import { httpLogger, logger } from "./utils/logger";
import { register } from "./utils/metrics";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(httpLogger);
app.use(cors({
  origin: "http://localhost:3000", // Adjust as needed
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser() as any);
app.use(express.urlencoded({ extended: true }));

// Routes will be mounted in startServer after Redis and Rate Limiters are initialized.

app.get("/", (req, res) => {
  res.send("Auth Flow Server is running with Observability");
});

app.get("/metrics", async (req, res) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
});

async function startServer() {
  try {
    // Connect to MongoDB
    if (process.env.MONGO_URI) {
        await mongoose.connect(process.env.MONGO_URI);
        logger.info("Connected to MongoDB");
    } else {
        logger.warn("MONGO_URI not found in .env");
    }

    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    app.set("redis", redis);
    logger.info("Connected to Redis");

    // Rate Limiting
    const { createRateLimiter } = await import("./middlewares/rateLimiter");
    
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
    app.use("/v1/auth", authRoutes);

    // Start Background Workers
    const { startAuthWorker } = await import("./queues/auth.queue");
    startAuthWorker();

    // Generate JWK Pair
    const jwkPair = await generateJWKPair();
    app.set("jwkPair", jwkPair);
    logger.info("Generated JWK Pair");

    const server = app.listen(PORT, () => {
      logger.info(`Auth Flow Server is running on port ${PORT}`);
    });

    // Graceful Shutdown
    const shutdown = async () => {
        logger.info("Shutting down gracefully...");
        server.close(async () => {
            logger.info("HTTP server closed.");
            await mongoose.connection.close();
            logger.info("MongoDB connection closed.");
            await redis.quit();
            logger.info("Redis connection closed.");
            process.exit(0);
        });

        // If server doesn't close in 10s, force close
        setTimeout(() => {
            logger.error("Could not close connections in time, forcefully shutting down");
            process.exit(1);
        }, 10000);
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

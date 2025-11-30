import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Redis from "ioredis";
import authRoutes from "./routes/auth";
import { generateJWKPair } from "./jwks";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: "http://localhost:3000", // Adjust as needed
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser() as any);
app.use(express.urlencoded({ extended: true }));

app.use("/v1/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Auth Server is running");
});

async function startServer() {
  try {
    // Connect to MongoDB
    if (process.env.MONGO_URI) {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");
    } else {
        console.warn("MONGO_URI not found in .env");
    }

    // Connect to Redis
    const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    app.set("redis", redis);
    console.log("Connected to Redis");

    // Generate JWK Pair
    const jwkPair = await generateJWKPair();
    app.set("jwkPair", jwkPair);
    console.log("Generated JWK Pair");

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();

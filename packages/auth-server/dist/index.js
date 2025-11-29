"use strict";
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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: "http://localhost:3000", // Adjust as needed
    credentials: true,
}));
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
app.use("/v1/auth", auth_1.default);
app.get("/", (req, res) => {
    res.send("Auth Server is running");
});
async function startServer() {
    try {
        // Connect to MongoDB
        if (process.env.MONGO_URI) {
            await mongoose_1.default.connect(process.env.MONGO_URI);
            console.log("Connected to MongoDB");
        }
        else {
            console.warn("MONGO_URI not found in .env");
        }
        // Connect to Redis
        const redis = new ioredis_1.default(process.env.REDIS_URL || "redis://localhost:6379");
        app.set("redis", redis);
        console.log("Connected to Redis");
        // Generate JWK Pair
        const jwkPair = await (0, jwks_1.generateJWKPair)();
        app.set("jwkPair", jwkPair);
        console.log("Generated JWK Pair");
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
}
startServer();

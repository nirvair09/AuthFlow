"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_model_1 = __importDefault(require("../models/user.model"));
const dotenv_1 = __importDefault(require("dotenv"));
const argon2_1 = __importDefault(require("argon2"));
const utils_1 = require("../utils");
const jose_1 = require("jose");
dotenv_1.default.config();
const router = express_1.default.Router();
const ACCESS_EXP = Number(process.env.ACCESS_TOKEN_EXP || 900); // seconds
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL || 7 * 24 * 3600);
router.post("/register", async (req, res) => {
    const { email, password, metadata } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    try {
        const existingUser = await user_model_1.default.findOne({ email }).lean();
        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }
        const passwordHash = await argon2_1.default.hash(password);
        const user = await user_model_1.default.create({
            email,
            password: passwordHash,
            metadata
        });
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                metadata: user.metadata
            }
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const redis = req.app.get("redis");
    const jwkPair = req.app.get("jwkPair");
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await user_model_1.default.findOne({ email }).lean();
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    try {
        const ok = await argon2_1.default.verify(user.password, password);
        if (!ok) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const sessionId = (0, utils_1.randomHex)(16);
        const refreshToken = (0, utils_1.randomHex)(32);
        const refreshHash = (0, utils_1.sha256hex)(refreshToken);
        const now = Math.floor(Date.now() / 1000);
        const jwt = await new jose_1.SignJWT({
            sub: user._id.toString(),
            sid: sessionId
        })
            .setProtectedHeader({ alg: "RS256" })
            .setIssuedAt(now)
            .setIssuer(process.env.JWT_ISSUER || "http://localhost:3000")
            .setExpirationTime(now + ACCESS_EXP)
            .setNotBefore(now)
            .sign(await importJwkPrivate(jwkPair));
        res.cookie("refresh", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: REFRESH_TTL * 1000
        });
        return res.status(200).json({
            message: "Login successful",
            access_token: jwt
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/refresh", async (req, res) => {
    const redis = req.app.get("redis");
    const jwtPair = req.app.get("jwtPair");
    const refreshToken = req.cookies?.refresh;
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token is required" });
    }
    const refreshHash = (0, utils_1.sha256hex)(refreshToken);
    const key = `refresh:${refreshHash}`;
    const data = await redis.get(key);
    if (!data)
        return res.status(401).json({ error: "Invalid refresh token" });
    await redis.del(key);
    const parsed = JSON.parse(data);
    const newSessionId = parsed.sessionId;
    const newRefreshToken = (0, utils_1.randomHex)(32);
    const newRefreshHash = (0, utils_1.sha256hex)(newRefreshToken);
    await redis.set(`refresh:${newRefreshHash}`, JSON.stringify({ userId: parsed.userId, sessionId: newSessionId }), "EX", REFRESH_TTL);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose_1.SignJWT({
        sub: parsed.userId,
        sid: newSessionId
    })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt(now)
        .setIssuer(process.env.JWT_ISSUER || "http://localhost:3000")
        .setExpirationTime(now + ACCESS_EXP)
        .setNotBefore(now)
        .sign(await importJwkPrivate(jwtPair));
    res.cookie("refresh", newRefreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: REFRESH_TTL * 1000
    });
    return res.status(200).json({
        message: "Refresh successful",
        access_token: jwt
    });
});
router.post("/sign-out", async (req, res) => {
    const redis = req.app.get("redis");
    const refreshToken = req.cookies?.refresh;
    if (refreshToken) {
        const refreshHash = (0, utils_1.sha256hex)(refreshToken);
        await redis.del(`refresh:${refreshHash}`);
        res.clearCookie("refresh");
    }
    return res.status(200).json({ message: "Logout successful" });
});
async function importJwkPrivate(jwkPair) {
    try {
        return await (0, jose_1.importJWK)(jwkPair.privateKey, "RS256");
    }
    catch (error) {
        return await (0, jose_1.importJWK)(jwkPair.privateKey, "RS256");
    }
}
exports.default = router;

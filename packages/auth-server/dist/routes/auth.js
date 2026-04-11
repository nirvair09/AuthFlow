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
const authenticate_1 = require("../middlewares/authenticate");
const auth_queue_1 = require("../queues/auth.queue");
// @ts-ignore
const otplib_1 = require("otplib");
const qrcode_1 = __importDefault(require("qrcode"));
const logger_1 = require("../utils/logger");
const metrics_1 = require("../utils/metrics");
dotenv_1.default.config();
const router = express_1.default.Router();
const ACCESS_EXP = Number(process.env.ACCESS_TOKEN_EXP || 900); // seconds
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL || 7 * 24 * 3600);
router.post("/register", async (req, res) => {
    const { email, password, name, metadata } = req.body;
    // console.log(email,password,name);
    if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
    }
    try {
        const existingUser = await user_model_1.default.findOne({ email }).lean();
        if (existingUser) {
            return res.status(400).json({ error: "User already exists" });
        }
        const passwordHash = await argon2_1.default.hash(password);
        const user = await user_model_1.default.create({
            email,
            name,
            password: passwordHash,
            metadata
        });
        await (0, auth_queue_1.publishAuthEvent)("USER_REGISTERED", {
            userId: user._id,
            email: user.email,
            name: user.name
        });
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                metadata: user.metadata
            }
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/sign-in", async (req, res) => {
    const { email, password } = req.body;
    const redis = req.app.get("redis");
    const jwkPair = req.app.get("jwkPair");
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    const user = await user_model_1.default.findOne({ email });
    if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
        return res.status(403).json({
            error: `Account is locked. Try again in ${remainingMinutes} minutes.`
        });
    }
    try {
        const ok = await argon2_1.default.verify(user.password, password);
        if (!ok) {
            metrics_1.authFailureTotal.inc();
            // Increment failed attempts
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 mins
                user.failedLoginAttempts = 0; // Reset after locking
            }
            await user.save();
            return res.status(401).json({ error: "Invalid credentials" });
        }
        // Login successful
        metrics_1.authSuccessTotal.inc();
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        const ip = req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";
        // Device Fingerprinting & suspicious login detection
        const isKnownDevice = user.knownDevices.some(d => d.ip === ip && d.userAgent === userAgent);
        if (!isKnownDevice) {
            await (0, auth_queue_1.publishAuthEvent)("SUSPICIOUS_LOGIN", {
                userId: user._id,
                email: user.email,
                ip,
                userAgent
            });
            logger_1.logger.warn(`Suspicious login for ${user.email} from new device: ${ip}`);
            user.knownDevices.push({ ip, userAgent, lastUsed: new Date() });
        }
        else {
            // Update last used for known device
            const device = user.knownDevices.find(d => d.ip === ip && d.userAgent === userAgent);
            if (device)
                device.lastUsed = new Date();
        }
        await user.save();
        // Check if 2FA is enabled
        if (user.isTwoFactorEnabled) {
            // Generate a temporary 2FA session token (valid for 5 mins)
            const mfaToken = (0, utils_1.randomHex)(32);
            await redis.set(`mfa:${mfaToken}`, user._id.toString(), "EX", 300);
            return res.status(200).json({
                message: "2FA required",
                mfa_token: mfaToken,
                next_step: "VERIFY_OTP"
            });
        }
        const sessionId = (0, utils_1.randomHex)(16);
        const refreshToken = (0, utils_1.randomHex)(32);
        const refreshHash = (0, utils_1.sha256hex)(refreshToken);
        // Store session with more context (IP, UA)
        await redis.set(`refresh:${refreshHash}`, JSON.stringify({
            userId: user._id.toString(),
            sessionId,
            role: user.role,
            context: { ip, userAgent }
        }), "EX", REFRESH_TTL);
        const now = Math.floor(Date.now() / 1000);
        const jwt = await new jose_1.SignJWT({
            sub: user._id.toString(),
            sid: sessionId,
            role: user.role
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
            access_token: jwt,
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/refresh", async (req, res) => {
    const redis = req.app.get("redis");
    const jwkPair = req.app.get("jwkPair");
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
    const userRole = parsed.role || "user";
    const newRefreshToken = (0, utils_1.randomHex)(32);
    const newRefreshHash = (0, utils_1.sha256hex)(newRefreshToken);
    await redis.set(`refresh:${newRefreshHash}`, JSON.stringify({
        userId: parsed.userId,
        sessionId: newSessionId,
        role: userRole
    }), "EX", REFRESH_TTL);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose_1.SignJWT({
        sub: parsed.userId,
        sid: newSessionId,
        role: userRole
    })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt(now)
        .setIssuer(process.env.JWT_ISSUER || "http://localhost:3000")
        .setExpirationTime(now + ACCESS_EXP)
        .setNotBefore(now)
        .sign(await importJwkPrivate(jwkPair));
    res.cookie("refresh", newRefreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
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
router.get("/profile", authenticate_1.authenticate, async (req, res) => {
    try {
        const user = await user_model_1.default.findById(req.user.id).select("_id email name metadata");
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        return res.json({
            user: {
                id: user._id.toString(),
                email: user.email,
                name: user.name,
                metadata: user.metadata,
            }
        });
    }
    catch (err) {
        return res.status(500).json({ error: "Internal server error" });
    }
});
async function importJwkPrivate(jwkPair) {
    try {
        return await (0, jose_1.importJWK)(jwkPair.privateKey, "RS256");
    }
    catch (error) {
        return await (0, jose_1.importJWK)(jwkPair.privateKey, "RS256");
    }
}
// --- 2FA & Multi-Factor Authentication ---
router.post("/2fa/setup", authenticate_1.authenticate, async (req, res) => {
    const user = await user_model_1.default.findById(req.user.id);
    if (!user)
        return res.status(404).json({ error: "User not found" });
    const secret = otplib_1.authenticator.generateSecret();
    const otpauth = otplib_1.authenticator.keyuri(user.email, "AuthFlow", secret);
    user.twoFactorSecret = secret;
    await user.save();
    const qrCodeUrl = await qrcode_1.default.toDataURL(otpauth);
    return res.json({
        secret,
        qrCode: qrCodeUrl
    });
});
router.post("/2fa/enable", authenticate_1.authenticate, async (req, res) => {
    const { token } = req.body;
    const user = await user_model_1.default.findById(req.user.id);
    if (!user || !user.twoFactorSecret)
        return res.status(400).json({ error: "2FA not setup" });
    const isValid = otplib_1.authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid)
        return res.status(400).json({ error: "Invalid OTP token" });
    user.isTwoFactorEnabled = true;
    await user.save();
    return res.json({ message: "2FA enabled successfully" });
});
router.post("/2fa/verify-login", async (req, res) => {
    const { mfa_token, token } = req.body;
    const redis = req.app.get("redis");
    const jwkPair = req.app.get("jwkPair");
    const userId = await redis.get(`mfa:${mfa_token}`);
    if (!userId)
        return res.status(401).json({ error: "Invalid or expired MFA session" });
    const user = await user_model_1.default.findById(userId);
    if (!user || !user.twoFactorSecret)
        return res.status(401).json({ error: "User or 2FA secret not found" });
    const isValid = otplib_1.authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid)
        return res.status(401).json({ error: "Invalid OTP token" });
    // Success - clean up MFA token
    await redis.del(`mfa:${mfa_token}`);
    // Issue tokens (same logic as sign-in)
    const sessionId = (0, utils_1.randomHex)(16);
    const refreshToken = (0, utils_1.randomHex)(32);
    const refreshHash = (0, utils_1.sha256hex)(refreshToken);
    await redis.set(`refresh:${refreshHash}`, JSON.stringify({ userId: user._id.toString(), sessionId, role: user.role }), "EX", REFRESH_TTL);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new jose_1.SignJWT({ sub: user._id.toString(), sid: sessionId, role: user.role })
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
    return res.json({ message: "Login successful", access_token: jwt });
});
// --- RBAC & Admin Routes ---
const authorize_1 = require("../middlewares/authorize");
router.get("/admin/dashboard", authenticate_1.authenticate, (0, authorize_1.authorize)(["admin"]), async (req, res) => {
    return res.json({ message: "Welcome to the Admin Dashboard", stats: { users: 1234, status: "healthy" } });
});
exports.default = router;

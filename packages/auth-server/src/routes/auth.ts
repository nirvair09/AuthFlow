import express from "express";
import User from "../models/user.model";
import dotenv from "dotenv";
import argon2 from "argon2";
import { Redis } from "ioredis";
import {randomHex, sha256hex} from "../utils";
import {SignJWT, importJWK} from "jose";
import {JWKPair} from "../jwks";
import { authenticate } from "../middlewares/authenticate";
import { publishAuthEvent } from "../queues/auth.queue";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { logger } from "../utils/logger";
import { authSuccessTotal, authFailureTotal } from "../utils/metrics";

dotenv.config();

const router = express.Router();

const ACCESS_EXP = Number(process.env.ACCESS_TOKEN_EXP || 900); // seconds
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL || 7 * 24 * 3600);

router.post("/register",async(req,res)=>{
    const {email,password,name,metadata}=req.body;
    // console.log(email,password,name);
    if(!email ||!password || !name){
        return res.status(400).json({error:"Email, password, and name are required"});
    }

    try {
        const existingUser = await User.findOne({email}).lean();
        if(existingUser){
            return res.status(400).json({error:"User already exists"});
        }

        const passwordHash = await argon2.hash(password);
        const user = await User.create({
            email,
            name,
            password:passwordHash,
            metadata
        });

        await publishAuthEvent("USER_REGISTERED", {
            userId: user._id,
            email: user.email,
            name: user.name
        });

        return res.status(201).json({
            message:"User registered successfully",
            user:{
                id:user._id,
                email:user.email,
                name:user.name,
                metadata:user.metadata
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:"Internal server error"});
    }
});


router.post("/sign-in",async(req,res)=>{
    const {email,password}=req.body;
    const redis:Redis = req.app.get("redis");
    const jwkPair=req.app.get("jwkPair");

    if(!email || !password){
        return res.status(400).json({error:"Email and password are required"});
    }

    const user = await User.findOne({email});
    if(!user){
        return res.status(401).json({error:"Invalid credentials"});
    }

    // Check account lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
        const remainingMinutes = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
        return res.status(403).json({ 
            error: `Account is locked. Try again in ${remainingMinutes} minutes.` 
        });
    }

    try {
        const ok = await argon2.verify(user.password,password);
        
        if(!ok){
            authFailureTotal.inc();
            // Increment failed attempts
            user.failedLoginAttempts += 1;
            if (user.failedLoginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // Lock for 15 mins
                user.failedLoginAttempts = 0; // Reset after locking
            }
            await user.save();
            return res.status(401).json({error:"Invalid credentials"});
        }

        // Login successful
        authSuccessTotal.inc();
        user.failedLoginAttempts = 0;
        user.lockUntil = undefined;
        
        const ip = req.ip;
        const userAgent = req.headers["user-agent"] || "unknown";

        // Device Fingerprinting & suspicious login detection
        const isKnownDevice = user.knownDevices.some(d => d.ip === ip && d.userAgent === userAgent);
        if (!isKnownDevice) {
            await publishAuthEvent("SUSPICIOUS_LOGIN", {
                userId: user._id,
                email: user.email,
                ip,
                userAgent
            });
            logger.warn(`Suspicious login for ${user.email} from new device: ${ip}`);
            user.knownDevices.push({ ip, userAgent, lastUsed: new Date() });
        } else {
            // Update last used for known device
            const device = user.knownDevices.find(d => d.ip === ip && d.userAgent === userAgent);
            if (device) device.lastUsed = new Date();
        }

        await user.save();

        // Check if 2FA is enabled
        if (user.isTwoFactorEnabled) {
            // Generate a temporary 2FA session token (valid for 5 mins)
            const mfaToken = randomHex(32);
            await redis.set(`mfa:${mfaToken}`, user._id.toString(), "EX", 300);
            return res.status(200).json({
                message: "2FA required",
                mfa_token: mfaToken,
                next_step: "VERIFY_OTP"
            });
        }

        const sessionId=randomHex(16);
        const refreshToken =randomHex(32);
        const refreshHash=sha256hex(refreshToken);

        // Store session with more context (IP, UA)
        await redis.set(
            `refresh:${refreshHash}`,
            JSON.stringify({ 
                userId: user._id.toString(), 
                sessionId,
                role: user.role,
                context: { ip, userAgent } 
            }),
            "EX",
            REFRESH_TTL
        );

        const now = Math.floor(Date.now()/1000);
        const jwt = await new SignJWT({
            sub:user._id.toString(),
            sid:sessionId,
            role: user.role
        })
          .setProtectedHeader({ alg: "RS256"})
          .setIssuedAt(now)
          .setIssuer(process.env.JWT_ISSUER||"http://localhost:3000")
          .setExpirationTime(now+ACCESS_EXP)
          .setNotBefore(now)
          .sign(await importJwkPrivate(jwkPair));


        res.cookie("refresh",refreshToken,{
            httpOnly:true,
            secure:false,
            sameSite:"lax",
            maxAge:REFRESH_TTL*1000
        })  ;

        return res.status(200).json({
            message:"Login successful",
            access_token:jwt,
            user: {
                id: user._id,
                email: user.email,
                name: user.name
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({error:"Internal server error"});
    }
})


router.post("/refresh",async(req,res)=>{
    const redis:Redis=req.app.get("redis");
    const jwkPair=req.app.get("jwkPair");

    const refreshToken=req.cookies?.refresh;
    if(!refreshToken){
        return res.status(401).json({error:"Refresh token is required"});
    }
    
    const refreshHash=sha256hex(refreshToken);
    const key=`refresh:${refreshHash}`;
    const data=await redis.get(key);
    if(!data) return res.status(401).json({error:"Invalid refresh token"});

    await redis.del(key);

    const parsed=JSON.parse(data);
    const newSessionId=parsed.sessionId;
    const userRole=parsed.role || "user";
    const newRefreshToken=randomHex(32);
    const newRefreshHash=sha256hex(newRefreshToken);
      await redis.set(`refresh:${newRefreshHash}`, JSON.stringify({ 
        userId: parsed.userId, 
        sessionId: newSessionId,
        role: userRole 
      }), "EX", REFRESH_TTL);

      const now=Math.floor(Date.now()/1000);
      const jwt = await new SignJWT({
        sub:parsed.userId,
        sid:newSessionId,
        role: userRole
      })
      .setProtectedHeader({alg:"RS256"})
      .setIssuedAt(now)
      .setIssuer(process.env.JWT_ISSUER||"http://localhost:3000")
      .setExpirationTime(now+ACCESS_EXP)
      .setNotBefore(now)
      .sign(await importJwkPrivate(jwkPair));

      res.cookie("refresh",newRefreshToken,{
        httpOnly:true,
        secure:false,
        sameSite:"lax",
        path:"/",
        maxAge:REFRESH_TTL*1000
      })

      return res.status(200).json({
        message:"Refresh successful",
        access_token:jwt
      })
})

router.post("/sign-out",async(req,res)=>{
    const redis:Redis=req.app.get("redis");
    const refreshToken=req.cookies?.refresh;
    if(refreshToken){
        const refreshHash=sha256hex(refreshToken);
        await redis.del(`refresh:${refreshHash}`);
        res.clearCookie("refresh");
    }

    return res.status(200).json({message:"Logout successful"});
})

router.get("/profile", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user!.id).select("_id email name metadata");

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
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});


async function importJwkPrivate(jwkPair:JWKPair){
    try {
        return await importJWK(jwkPair.privateKey,"RS256");
    } catch (error) {
        return await importJWK(jwkPair.privateKey,"RS256");
    }
}


// --- 2FA & Multi-Factor Authentication ---

router.post("/2fa/setup", authenticate, async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, "AuthFlow", secret);
    
    user.twoFactorSecret = secret;
    await user.save();

    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    
    return res.json({
        secret,
        qrCode: qrCodeUrl
    });
});

router.post("/2fa/enable", authenticate, async (req, res) => {
    const { token } = req.body;
    const user = await User.findById(req.user!.id);
    if (!user || !user.twoFactorSecret) return res.status(400).json({ error: "2FA not setup" });

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) return res.status(400).json({ error: "Invalid OTP token" });

    user.isTwoFactorEnabled = true;
    await user.save();

    return res.json({ message: "2FA enabled successfully" });
});

router.post("/2fa/verify-login", async (req, res) => {
    const { mfa_token, token } = req.body;
    const redis: Redis = req.app.get("redis");
    const jwkPair = req.app.get("jwkPair");

    const userId = await redis.get(`mfa:${mfa_token}`);
    if (!userId) return res.status(401).json({ error: "Invalid or expired MFA session" });

    const user = await User.findById(userId);
    if (!user || !user.twoFactorSecret) return res.status(401).json({ error: "User or 2FA secret not found" });

    const isValid = authenticator.verify({ token, secret: user.twoFactorSecret });
    if (!isValid) return res.status(401).json({ error: "Invalid OTP token" });

    // Success - clean up MFA token
    await redis.del(`mfa:${mfa_token}`);

    // Issue tokens (same logic as sign-in)
    const sessionId = randomHex(16);
    const refreshToken = randomHex(32);
    const refreshHash = sha256hex(refreshToken);

    await redis.set(
        `refresh:${refreshHash}`,
        JSON.stringify({ userId: user._id.toString(), sessionId, role: user.role }),
        "EX",
        REFRESH_TTL
    );

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({ sub: user._id.toString(), sid: sessionId, role: user.role })
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
import { authorize } from "../middlewares/authorize";

router.get("/admin/dashboard", authenticate, authorize(["admin"]), async (req, res) => {
    return res.json({ message: "Welcome to the Admin Dashboard", stats: { users: 1234, status: "healthy" } });
});

export default router;
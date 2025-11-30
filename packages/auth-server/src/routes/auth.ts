import express from "express";
import User from "../models/user.model";
import dotenv from "dotenv";
import argon2 from "argon2";
import { Redis } from "ioredis";
import {randomHex, sha256hex} from "../utils";
import {SignJWT, importJWK} from "jose";
import {JWKPair} from "../jwks";
import { authenticate } from "../middlewares/authenticate";

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

    const user = await User.findOne({email}).lean();
    if(!user){
        return res.status(401).json({error:"Invalid credentials"});
    }

    try {
        const ok = await argon2.verify(user.password,password);
        if(!ok){
            return res.status(401).json({error:"Invalid credentials"});
        }

        const sessionId=randomHex(16);
        const refreshToken =randomHex(32);
        const refreshHash=sha256hex(refreshToken);

        await redis.set(
  `refresh:${refreshHash}`,
  JSON.stringify({ userId: user._id.toString(), sessionId }),
  "EX",
  REFRESH_TTL
);

        const now = Math.floor(Date.now()/1000);
        const jwt = await new SignJWT({
            sub:user._id.toString(),
            sid:sessionId
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
            access_token:jwt
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
    const newRefreshToken=randomHex(32);
    const newRefreshHash=sha256hex(newRefreshToken);
      await redis.set(`refresh:${newRefreshHash}`, JSON.stringify({ userId: parsed.userId, sessionId: newSessionId }), "EX", REFRESH_TTL);

      const now=Math.floor(Date.now()/1000);
      const jwt = await new SignJWT({
        sub:parsed.userId,
        sid:newSessionId
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


export default router;
import express from "express";
import User from "../src/models/user.model";
import dotenv from "dotenv";
import argon2 from "argon2";


dotenv.config();

const router = express.Router();

const ACCESS_EXP = Number(process.env.ACCESS_TOKEN_EXP || 900); // seconds
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL || 7 * 24 * 3600);

router.post("/register",async(req,res)=>{
    const {email,password,metadata}=req.body;

    if(!email ||!password){
        return res.status(400).json({error:"Email and password are required"});
    }

    try {
        const existingUser = await User.findOne({email}).lean();
        if(existingUser){
            return res.status(400).json({error:"User already exists"});
        }

        const passwordHash = await argon2.hash(password);
        const user = await User.create({
            email,
            password:passwordHash,
            metadata
        });

        return res.status(201).json({
            message:"User registered successfully",
            user:{
                id:user._id,
                email:user.email,
                metadata:user.metadata
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:"Internal server error"});
    }
})
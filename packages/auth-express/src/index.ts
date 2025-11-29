import {Request,Response,NextFunction} from "express";
import fetch from "node-fetch";
import {createRemoteJWKSet,jwtVerify} from "jose";


export async function createMiddleware(opts:{jwksUrl:string;issuer?:string}) {
    const {jwksUrl,issuer}=opts;

    const jwks=createRemoteJWKSet(new URL(jwksUrl),{timeoutDuration:60000});

    return async function authMiddleware(req:Request,res:Response,next:NextFunction){

        try {
            const authHeader=req.headers.authorization;
            if(!authHeader){
                return res.status(401).json({error:"Unauthorized"});
            }
            const token=authHeader.split(" ")[1];
            if(!token){
                return res.status(401).json({error:"Unauthorized"});
            }
            const {payload}=await jwtVerify(token,jwks,{issuer:issuer||undefined});

            req.auth={
                sub:payload.sub,
                sid:(payload as any).sid,
                claims:payload
            };

            next();
            
        } catch (error) {
            console.log(error);
            return res.status(401).json({error:"Unauthorized"});
        }
    };    
}

export default createMiddleware;
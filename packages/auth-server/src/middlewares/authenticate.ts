import { NextFunction, Request, Response } from "express";
import { jwtVerify, importJWK } from "jose";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid token" });
    }

    const token = auth.split(" ")[1];

    const jwkPair = req.app.get("jwkPair");

    const publicKey = await importJWK(jwkPair.publicKey, "RS256");

    const { payload } = await jwtVerify(token, publicKey, {
      issuer: process.env.JWT_ISSUER || "http://localhost:3000",
    });

    // add user info to request
    req.user = {
      id: payload.sub as string,
      sessionId: payload.sid as string,
    };

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired access token" });
  }
}

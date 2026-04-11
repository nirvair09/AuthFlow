"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jose_1 = require("jose");
async function authenticate(req, res, next) {
    try {
        const auth = req.headers.authorization;
        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Missing or invalid token" });
        }
        const token = auth.split(" ")[1];
        const jwkPair = req.app.get("jwkPair");
        const publicKey = await (0, jose_1.importJWK)(jwkPair.publicKey, "RS256");
        const { payload } = await (0, jose_1.jwtVerify)(token, publicKey, {
            issuer: process.env.JWT_ISSUER || "http://localhost:3000",
        });
        // add user info to request
        req.user = {
            id: payload.sub,
            sessionId: payload.sid,
            role: payload.role,
        };
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Invalid or expired access token" });
    }
}

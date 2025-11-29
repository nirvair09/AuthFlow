"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMiddleware = createMiddleware;
const jose_1 = require("jose");
async function createMiddleware(opts) {
    const { jwksUrl, issuer } = opts;
    const jwks = (0, jose_1.createRemoteJWKSet)(new URL(jwksUrl), { timeoutDuration: 60000 });
    return async function authMiddleware(req, res, next) {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const token = authHeader.split(" ")[1];
            if (!token) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const { payload } = await (0, jose_1.jwtVerify)(token, jwks, { issuer: issuer || undefined });
            req.auth = {
                sub: payload.sub,
                sid: payload.sid,
                claims: payload
            };
            next();
        }
        catch (error) {
            console.log(error);
            return res.status(401).json({ error: "Unauthorized" });
        }
    };
}
exports.default = createMiddleware;
//# sourceMappingURL=index.js.map
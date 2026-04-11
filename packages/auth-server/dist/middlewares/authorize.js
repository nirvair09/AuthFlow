"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = void 0;
/**
 * Middleware to restrict access to specific roles.
 */
const authorize = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        // We assume req.user has a role property (we will update the authenticate middleware)
        const userRole = req.user.role || "user";
        if (!roles.includes(userRole)) {
            return res.status(403).json({
                error: `Forbidden: This action requires one of the following roles: ${roles.join(", ")}`
            });
        }
        next();
    };
};
exports.authorize = authorize;

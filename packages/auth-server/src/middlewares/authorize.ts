import { Request, Response, NextFunction } from "express";

/**
 * Middleware to restrict access to specific roles.
 */
export const authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        // We assume req.user has a role property (we will update the authenticate middleware)
        const userRole = (req.user as any).role || "user";

        if (!roles.includes(userRole)) {
            return res.status(403).json({ 
                error: `Forbidden: This action requires one of the following roles: ${roles.join(", ")}` 
            });
        }

        next();
    };
};

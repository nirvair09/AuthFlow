import { Request, Response, NextFunction } from "express";
export declare function createMiddleware(opts: {
    jwksUrl: string;
    issuer?: string;
}): Promise<(req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>>;
export default createMiddleware;
//# sourceMappingURL=index.d.ts.map
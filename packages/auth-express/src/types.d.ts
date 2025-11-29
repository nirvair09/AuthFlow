import { JWTPayload } from "jose";

declare global {
  namespace Express {
    interface Request {
      auth?: JWTPayload;
    }
  }
}

export {};

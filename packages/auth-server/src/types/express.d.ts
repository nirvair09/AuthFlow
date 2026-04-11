declare namespace Express {
  interface Request {
    user?: {
      id: string | undefined;
      sessionId: string | undefined;
      role?: string;
    };
  }
}

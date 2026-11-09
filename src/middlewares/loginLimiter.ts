import { Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { logLogin } from "../utils/loginLog.js";

export const loginLimiter = rateLimit({
  windowMs: env.loginWindowMinutes * 60 * 1000,
  limit: env.loginMaxAttempts,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req: Request, res: Response) => {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    await logLogin({ email, success: false, reason: "RATE_LIMITED", req });
    res.status(429).json({ message: "Trop de tentatives, réessayez plus tard" });
  },
});

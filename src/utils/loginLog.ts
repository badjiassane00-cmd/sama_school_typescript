import { Request } from "express";
import { LoginLog } from "../models/index.js";

type Entree = {
  userId?: number | null;
  email: string;
  success: boolean;
  reason: string;
  req: Request;
};

export async function logLogin({ userId, email, success, reason, req }: Entree) {
  await LoginLog.create({
    userId: userId ?? null,
    email,
    success,
    reason,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

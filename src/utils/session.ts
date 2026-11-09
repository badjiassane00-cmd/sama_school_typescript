import crypto from "node:crypto";
import { Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/index.js";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number, req: Request) {
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + env.refreshTokenDays * 24 * 60 * 60 * 1000);

  const session = await RefreshToken.create({
    userId,
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });

  const accessToken = jwt.sign({ sid: session.id }, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

  return { accessToken, refreshToken };
}

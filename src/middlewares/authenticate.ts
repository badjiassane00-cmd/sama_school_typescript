import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { RefreshToken, User } from "../models/index.js";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token manquant" });
    return;
  }

  let payload: jwt.JwtPayload;
  try {
    const decoded = jwt.verify(header.slice(7), env.jwtSecret);
    if (typeof decoded === "string") {
      throw new Error("payload invalide");
    }
    payload = decoded;
  } catch {
    res.status(401).json({ message: "Token invalide ou expiré" });
    return;
  }

  const session = await RefreshToken.findByPk(payload.sid);
  if (!session || session.revokedAt || session.expiresAt < new Date() || String(session.userId) !== payload.sub) {
    res.status(401).json({ message: "Session révoquée ou expirée" });
    return;
  }

  const user = await User.findByPk(session.userId);
  if (!user) {
    res.status(401).json({ message: "Utilisateur introuvable" });
    return;
  }

  res.locals.user = { id: user.id, role: user.role, sid: session.id };
  next();
}

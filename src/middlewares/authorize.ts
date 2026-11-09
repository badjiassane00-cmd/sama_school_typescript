import { NextFunction, Request, Response } from "express";
import { Role } from "../config/roles.js";

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: "Accès interdit pour votre rôle" });
      return;
    }
    next();
  };
}

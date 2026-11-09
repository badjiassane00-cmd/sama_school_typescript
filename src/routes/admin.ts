import { Request, Response } from "express";
import { app } from "../app.js";
import { ROLES, Role } from "../config/roles.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { LoginLog, Profile, User } from "../models/index.js";
import { findPublicUser } from "../utils/users.js";

app.get("/users", authenticate, authorize("ADMIN"), async (req: Request, res: Response) => {
  const users = await User.findAll({ include: [{ model: Profile, as: "profile" }], order: [["id", "ASC"]] });
  res.json(users);
});

app.patch("/users/:id/role", authenticate, authorize("ADMIN"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const role = req.body?.role;

  if (!ROLES.includes(role)) {
    res.status(400).json({ message: `role doit être une des valeurs : ${ROLES.join(", ")}` });
    return;
  }
  if (id === res.locals.user.id) {
    res.status(400).json({ message: "Vous ne pouvez pas modifier votre propre rôle" });
    return;
  }

  const user = await User.findByPk(id);
  if (!user) {
    res.status(404).json({ message: "Utilisateur introuvable" });
    return;
  }

  user.role = role as Role;
  await user.save();
  res.json(await findPublicUser(user.id));
});

app.get("/admin/login-logs", authenticate, authorize("ADMIN"), async (req: Request, res: Response) => {
  const logs = await LoginLog.findAll({ order: [["id", "DESC"]], limit: 100 });
  res.json(logs);
});

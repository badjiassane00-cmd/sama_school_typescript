import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { UniqueConstraintError } from "sequelize";
import { app } from "../app.js";
import { sequelize } from "../config/database.js";
import { authenticate } from "../middlewares/authenticate.js";
import { loginLimiter } from "../middlewares/loginLimiter.js";
import { Profile, RefreshToken, User } from "../models/index.js";
import { logLogin } from "../utils/loginLog.js";
import { createSession, hashToken } from "../utils/session.js";
import { findPublicUser } from "../utils/users.js";

const register = async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body ?? {};

  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ message: "firstName, lastName, email et password sont obligatoires" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères" });
    return;
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const user = await sequelize.transaction(async (transaction) => {
      const created = await User.create({ email: String(email).trim().toLowerCase(), password: hash }, { transaction });
      await Profile.create({ userId: created.id, firstName: String(firstName), lastName: String(lastName) }, { transaction });
      return created;
    });
    res.status(201).json(await findPublicUser(user.id));
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      res.status(409).json({ message: "Cet email est déjà utilisé" });
      return;
    }
    throw error;
  }
};

app.post("/auth/register", register);
app.post("/register", register);

const login = async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ message: "email et password sont obligatoires" });
    return;
  }

  const normalise = String(email).trim().toLowerCase();
  const user = await User.unscoped().findOne({ where: { email: normalise } });
  const valide = user ? await bcrypt.compare(String(password), user.password) : false;

  if (!user || !valide) {
    await logLogin({
      userId: user?.id ?? null,
      email: normalise,
      success: false,
      reason: user ? "BAD_PASSWORD" : "UNKNOWN_EMAIL",
      req,
    });
    res.status(401).json({ message: "Email ou mot de passe incorrect" });
    return;
  }

  const tokens = await createSession(user.id, req);
  await logLogin({ userId: user.id, email: normalise, success: true, reason: "OK", req });
  res.json({ ...tokens, user: await findPublicUser(user.id) });
};

app.post("/auth/login", loginLimiter, login);
app.post("/login", loginLimiter, login);

app.post("/auth/refresh", async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};

  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ message: "refreshToken est obligatoire" });
    return;
  }

  const session = await RefreshToken.findOne({ where: { tokenHash: hashToken(refreshToken) } });
  if (!session) {
    res.status(401).json({ message: "Refresh token invalide" });
    return;
  }

  if (session.revokedAt) {
    // Un token déjà utilisé ou révoqué est rejoue : on coupe toutes les sessions de cet utilisateur.
    await RefreshToken.update({ revokedAt: new Date() }, { where: { userId: session.userId, revokedAt: null } });
    res.status(401).json({ message: "Refresh token révoqué" });
    return;
  }

  if (session.expiresAt < new Date()) {
    res.status(401).json({ message: "Refresh token expiré" });
    return;
  }

  session.revokedAt = new Date();
  await session.save();
  res.json(await createSession(session.userId, req));
});

app.post("/auth/logout", authenticate, async (req: Request, res: Response) => {
  await RefreshToken.update({ revokedAt: new Date() }, { where: { id: res.locals.user.sid } });
  res.status(204).send();
});

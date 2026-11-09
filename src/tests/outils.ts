import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../app.js";
import { Role } from "../config/roles.js";
import { Profile, User } from "../models/index.js";

export const MOT_DE_PASSE = "Password123!";

export async function creerUtilisateur(email: string, role: Role) {
  const utilisateur = await User.create({ email, password: await bcrypt.hash(MOT_DE_PASSE, 4), role });
  await Profile.create({ userId: utilisateur.id, firstName: "Test", lastName: role });
  return utilisateur;
}

export async function obtenirJeton(email: string) {
  const res = await request(app).post("/auth/login").send({ email, password: MOT_DE_PASSE });
  assert.equal(res.status, 200);
  return res.body.accessToken as string;
}

export function enteteAuthorization(jeton: string) {
  return { Authorization: `Bearer ${jeton}` };
}

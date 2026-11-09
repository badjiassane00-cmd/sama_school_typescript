import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { app } from "../app.js";
import { sequelize } from "../config/database.js";
import { env } from "../config/env.js";
import { Role } from "../config/roles.js";
import { LoginLog, Profile, RefreshToken, User } from "../models/index.js";
import "../routes/index.js";
import { hashToken } from "../utils/session.js";

const PASSWORD = "Password123!";

async function makeUser(email: string, role: Role) {
  const user = await User.create({ email, password: await bcrypt.hash(PASSWORD, 4), role });
  await Profile.create({ userId: user.id, firstName: "Test", lastName: role });
  return user;
}

function login(email: string, password = PASSWORD) {
  return request(app).post("/auth/login").send({ email, password });
}

async function tokensFor(email: string) {
  const res = await login(email);
  assert.equal(res.status, 200);
  return res.body as { accessToken: string; refreshToken: string };
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

function assertNoPassword(body: unknown) {
  const texte = JSON.stringify(body).toLowerCase();
  assert.ok(!texte.includes("\"password\":"), "la réponse contient le champ password");
  assert.ok(!texte.includes("$2"), "la réponse contient un hash bcrypt");
}

type Methode = "get" | "post" | "patch";
const routesPrivees: [Methode, string][] = [
  ["get", "/me"],
  ["patch", "/me/profile"],
  ["post", "/auth/logout"],
  ["get", "/users"],
  ["patch", "/users/1/role"],
  ["get", "/admin/login-logs"],
  ["get", "/teacher/dashboard"],
  ["get", "/learner/dashboard"],
];

describe("Authentification et autorisations", () => {
  let admin: Awaited<ReturnType<typeof makeUser>>;

  before(async () => {
    if (!env.db.name.endsWith("_test")) {
      throw new Error("Les tests doivent utiliser une base dont le nom finit par _test");
    }
    await sequelize.sync({ force: true });
    admin = await makeUser("admin@test.sn", "ADMIN");
    await makeUser("prof@test.sn", "TEACHER");
    await makeUser("eleve@test.sn", "LEARNER");
  });

  after(async () => {
    await sequelize.close();
  });

  describe("Inscription", () => {
    it("crée un compte LEARNER avec son profil, sans renvoyer le mot de passe", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ firstName: "Moussa", lastName: "Ba", email: "Moussa@Test.sn", password: "motdepasse1" });
      assert.equal(res.status, 201);
      assert.equal(res.body.email, "moussa@test.sn");
      assert.equal(res.body.role, "LEARNER");
      assert.equal(res.body.profile.firstName, "Moussa");
      assertNoPassword(res.body);
    });

    it("accepte aussi l'inscription sur /register", async () => {
      const res = await request(app)
        .post("/register")
        .send({ firstName: "Awa", lastName: "Diallo", email: "awa@test.sn", password: "motdepasse1" });
      assert.equal(res.status, 201);
      assert.equal(res.body.email, "awa@test.sn");
    });

    it("hache le mot de passe en base", async () => {
      const user = await User.unscoped().findOne({ where: { email: "moussa@test.sn" } });
      assert.ok(user);
      assert.notEqual(user.password, "motdepasse1");
      assert.ok(user.password.startsWith("$2"));
    });

    it("ignore un rôle envoyé par le client", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ firstName: "Pirate", lastName: "X", email: "pirate@test.sn", password: "motdepasse1", role: "ADMIN" });
      assert.equal(res.status, 201);
      assert.equal(res.body.role, "LEARNER");
    });

    it("refuse un email déjà utilisé (409)", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ firstName: "A", lastName: "B", email: "moussa@test.sn", password: "motdepasse1" });
      assert.equal(res.status, 409);
    });

    it("refuse un mot de passe trop court ou des champs manquants (400)", async () => {
      const court = await request(app)
        .post("/auth/register")
        .send({ firstName: "A", lastName: "B", email: "c@test.sn", password: "court" });
      assert.equal(court.status, 400);
      const vide = await request(app).post("/auth/register").send({});
      assert.equal(vide.status, 400);
    });
  });

  describe("Connexion", () => {
    it("renvoie access token, refresh token et utilisateur sans mot de passe", async () => {
      const res = await login("eleve@test.sn");
      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.ok(res.body.refreshToken);
      assert.equal(res.body.user.role, "LEARNER");
      assertNoPassword(res.body.user);
    });

    it("accepte aussi la connexion sur /login", async () => {
      const res = await request(app).post("/login").send({ email: "eleve@test.sn", password: PASSWORD });
      assert.equal(res.status, 200);
      assert.ok(res.body.accessToken);
      assert.ok(res.body.refreshToken);
    });

    it("refuse un mauvais mot de passe et un email inconnu avec le même message (401)", async () => {
      const mauvais = await login("eleve@test.sn", "faux");
      const inconnu = await login("inconnu@test.sn", "faux");
      assert.equal(mauvais.status, 401);
      assert.equal(inconnu.status, 401);
      assert.equal(mauvais.body.message, inconnu.body.message);
    });

    it("stocke le refresh token haché, jamais en clair", async () => {
      const { refreshToken } = await tokensFor("eleve@test.sn");
      const enBase = await RefreshToken.findOne({ where: { tokenHash: hashToken(refreshToken) } });
      assert.ok(enBase);
      assert.notEqual(enBase.tokenHash, refreshToken);
    });

    it("journalise les succès et les échecs", async () => {
      const succes = await LoginLog.findOne({ where: { success: true, email: "eleve@test.sn" } });
      assert.ok(succes);
      const echecMdp = await LoginLog.findOne({ where: { reason: "BAD_PASSWORD" } });
      assert.ok(echecMdp);
      assert.ok(echecMdp.userId);
      const echecEmail = await LoginLog.findOne({ where: { reason: "UNKNOWN_EMAIL" } });
      assert.ok(echecEmail);
      assert.equal(echecEmail.email, "inconnu@test.sn");
    });
  });

  describe("Routes privées : authentification", () => {
    for (const [methode, chemin] of routesPrivees) {
      it(`${methode.toUpperCase()} ${chemin} refuse une requête sans token (401)`, async () => {
        const res = await request(app)[methode](chemin);
        assert.equal(res.status, 401);
      });

      it(`${methode.toUpperCase()} ${chemin} refuse un token invalide (401)`, async () => {
        const res = await request(app)[methode](chemin).set(bearer("pas.un.token"));
        assert.equal(res.status, 401);
      });

      it(`${methode.toUpperCase()} ${chemin} refuse un token expiré (401)`, async () => {
        const expire = jwt.sign({ sid: 1, exp: Math.floor(Date.now() / 1000) - 60 }, env.jwtSecret, { subject: "1" });
        const res = await request(app)[methode](chemin).set(bearer(expire));
        assert.equal(res.status, 401);
      });
    }

    it("refuse un token signé avec une autre clé (401)", async () => {
      const faux = jwt.sign({ sid: 1 }, "autre-cle-secrete", { subject: "1", expiresIn: "1h" });
      const res = await request(app).get("/me").set(bearer(faux));
      assert.equal(res.status, 401);
    });
  });

  describe("Routes privées : autorisations par rôle", () => {
    it("GET /me renvoie le bon utilisateur pour chaque rôle, sans mot de passe", async () => {
      for (const [email, role] of [["admin@test.sn", "ADMIN"], ["prof@test.sn", "TEACHER"], ["eleve@test.sn", "LEARNER"]]) {
        const { accessToken } = await tokensFor(email);
        const res = await request(app).get("/me").set(bearer(accessToken));
        assert.equal(res.status, 200);
        assert.equal(res.body.email, email);
        assert.equal(res.body.role, role);
        assertNoPassword(res.body);
      }
    });

    it("PATCH /me/profile modifie son propre profil", async () => {
      const { accessToken } = await tokensFor("eleve@test.sn");
      const res = await request(app).patch("/me/profile").set(bearer(accessToken)).send({ phone: "770000000", bio: "Bonjour" });
      assert.equal(res.status, 200);
      assert.equal(res.body.profile.phone, "770000000");
      assertNoPassword(res.body);
      const vide = await request(app).patch("/me/profile").set(bearer(accessToken)).send({ firstName: "  " });
      assert.equal(vide.status, 400);
    });

    it("un apprenant ne peut pas appeler une route professeur (403)", async () => {
      const { accessToken } = await tokensFor("eleve@test.sn");
      const res = await request(app).get("/teacher/dashboard").set(bearer(accessToken));
      assert.equal(res.status, 403);
    });

    it("un apprenant ne peut appeler aucune route admin (403)", async () => {
      const { accessToken } = await tokensFor("eleve@test.sn");
      assert.equal((await request(app).get("/users").set(bearer(accessToken))).status, 403);
      assert.equal((await request(app).get("/admin/login-logs").set(bearer(accessToken))).status, 403);
      const modif = await request(app).patch("/users/1/role").set(bearer(accessToken)).send({ role: "ADMIN" });
      assert.equal(modif.status, 403);
    });

    it("un apprenant accède à son espace (200)", async () => {
      const { accessToken } = await tokensFor("eleve@test.sn");
      const res = await request(app).get("/learner/dashboard").set(bearer(accessToken));
      assert.equal(res.status, 200);
    });

    it("un professeur accède à son espace mais pas aux espaces apprenant et admin", async () => {
      const { accessToken } = await tokensFor("prof@test.sn");
      assert.equal((await request(app).get("/teacher/dashboard").set(bearer(accessToken))).status, 200);
      assert.equal((await request(app).get("/learner/dashboard").set(bearer(accessToken))).status, 403);
      assert.equal((await request(app).get("/users").set(bearer(accessToken))).status, 403);
    });

    it("un admin liste les utilisateurs sans mot de passe et lit le journal des connexions", async () => {
      const { accessToken } = await tokensFor("admin@test.sn");
      const users = await request(app).get("/users").set(bearer(accessToken));
      assert.equal(users.status, 200);
      assert.ok(users.body.length >= 3);
      assertNoPassword(users.body);
      const logs = await request(app).get("/admin/login-logs").set(bearer(accessToken));
      assert.equal(logs.status, 200);
      assert.ok(logs.body.length > 0);
      assertNoPassword(logs.body);
      assert.equal((await request(app).get("/teacher/dashboard").set(bearer(accessToken))).status, 200);
    });

    it("un admin change un rôle, appliqué immédiatement", async () => {
      const cible = await makeUser("promu@test.sn", "LEARNER");
      const tokens = await tokensFor("promu@test.sn");
      assert.equal((await request(app).get("/teacher/dashboard").set(bearer(tokens.accessToken))).status, 403);

      const { accessToken } = await tokensFor("admin@test.sn");
      const res = await request(app).patch(`/users/${cible.id}/role`).set(bearer(accessToken)).send({ role: "TEACHER" });
      assert.equal(res.status, 200);
      assert.equal(res.body.role, "TEACHER");
      assertNoPassword(res.body);

      assert.equal((await request(app).get("/teacher/dashboard").set(bearer(tokens.accessToken))).status, 200);
    });

    it("refuse un rôle invalide, un utilisateur inconnu et la modification de son propre rôle", async () => {
      const { accessToken } = await tokensFor("admin@test.sn");
      const invalide = await request(app).patch("/users/2/role").set(bearer(accessToken)).send({ role: "ROOT" });
      assert.equal(invalide.status, 400);
      const inconnu = await request(app).patch("/users/99999/role").set(bearer(accessToken)).send({ role: "TEACHER" });
      assert.equal(inconnu.status, 404);
      const soiMeme = await request(app).patch(`/users/${admin.id}/role`).set(bearer(accessToken)).send({ role: "LEARNER" });
      assert.equal(soiMeme.status, 400);
    });
  });

  describe("Refresh token, déconnexion et révocation", () => {
    it("le refresh renvoie de nouveaux tokens et invalide le premier couple", async () => {
      await makeUser("refresh@test.sn", "LEARNER");
      const ancien = await tokensFor("refresh@test.sn");

      const res = await request(app).post("/auth/refresh").send({ refreshToken: ancien.refreshToken });
      assert.equal(res.status, 200);
      assert.notEqual(res.body.refreshToken, ancien.refreshToken);
      assert.equal((await request(app).get("/me").set(bearer(res.body.accessToken))).status, 200);
      assert.equal((await request(app).get("/me").set(bearer(ancien.accessToken))).status, 401);
    });

    it("rejouer un refresh token déjà utilisé est refusé et coupe toutes les sessions", async () => {
      await makeUser("rejeu@test.sn", "LEARNER");
      const ancien = await tokensFor("rejeu@test.sn");
      const nouveau = (await request(app).post("/auth/refresh").send({ refreshToken: ancien.refreshToken })).body;

      const rejeu = await request(app).post("/auth/refresh").send({ refreshToken: ancien.refreshToken });
      assert.equal(rejeu.status, 401);
      assert.equal((await request(app).get("/me").set(bearer(nouveau.accessToken))).status, 401);
      assert.equal((await request(app).post("/auth/refresh").send({ refreshToken: nouveau.refreshToken })).status, 401);
    });

    it("refuse un refresh token inconnu (401) ou absent (400)", async () => {
      assert.equal((await request(app).post("/auth/refresh").send({ refreshToken: "inconnu" })).status, 401);
      assert.equal((await request(app).post("/auth/refresh").send({})).status, 400);
    });

    it("la déconnexion révoque les deux tokens", async () => {
      await makeUser("logout@test.sn", "LEARNER");
      const tokens = await tokensFor("logout@test.sn");
      assert.equal((await request(app).get("/me").set(bearer(tokens.accessToken))).status, 200);

      const sortie = await request(app).post("/auth/logout").set(bearer(tokens.accessToken));
      assert.equal(sortie.status, 204);

      assert.equal((await request(app).get("/me").set(bearer(tokens.accessToken))).status, 401);
      assert.equal((await request(app).post("/auth/refresh").send({ refreshToken: tokens.refreshToken })).status, 401);
    });

    it("un refresh token expiré est refusé, et la session expirée aussi", async () => {
      await makeUser("expire@test.sn", "LEARNER");
      const tokens = await tokensFor("expire@test.sn");
      await RefreshToken.update(
        { expiresAt: new Date(Date.now() - 1000) },
        { where: { tokenHash: hashToken(tokens.refreshToken) } }
      );
      assert.equal((await request(app).post("/auth/refresh").send({ refreshToken: tokens.refreshToken })).status, 401);
      assert.equal((await request(app).get("/me").set(bearer(tokens.accessToken))).status, 401);
    });
  });

  describe("Limitation des tentatives de connexion", () => {
    it("bloque après trop de tentatives échouées (429), même avec le bon mot de passe, et le journalise", async () => {
      let bloque = false;
      for (let i = 0; i < env.loginMaxAttempts + 2; i++) {
        const res = await login("eleve@test.sn", "mauvais");
        if (res.status === 429) {
          bloque = true;
          break;
        }
        assert.equal(res.status, 401);
      }
      assert.ok(bloque, "aucun blocage 429 observé");

      const bon = await login("eleve@test.sn");
      assert.equal(bon.status, 429);

      const log = await LoginLog.findOne({ where: { reason: "RATE_LIMITED" } });
      assert.ok(log);
    });
  });
});

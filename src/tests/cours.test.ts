import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { app } from "../app.js";
import { sequelize } from "../config/database.js";
import { env } from "../config/env.js";
import { Cours, User } from "../models/index.js";
import "../routes/index.js";
import { creerUtilisateur, enteteAuthorization, obtenirJeton } from "./outils.js";

describe("Cours : création et modification", () => {
  let prof1: User;
  let prof2: User;
  let jetonProf1: string;
  let jetonProf2: string;
  let jetonAdmin: string;
  let jetonEleve: string;

  before(async () => {
    if (!env.db.name.endsWith("_test")) {
      throw new Error("Les tests doivent utiliser une base dont le nom finit par _test");
    }
    await sequelize.sync({ force: true });
    prof1 = await creerUtilisateur("prof1@test.sn", "TEACHER");
    prof2 = await creerUtilisateur("prof2@test.sn", "TEACHER");
    await creerUtilisateur("admin@test.sn", "ADMIN");
    await creerUtilisateur("eleve@test.sn", "LEARNER");
    jetonProf1 = await obtenirJeton("prof1@test.sn");
    jetonProf2 = await obtenirJeton("prof2@test.sn");
    jetonAdmin = await obtenirJeton("admin@test.sn");
    jetonEleve = await obtenirJeton("eleve@test.sn");
  });

  after(async () => {
    await sequelize.close();
  });

  async function creerCours(jeton: string, titre = "Algorithmique", description = "Les bases") {
    const res = await request(app).post("/courses").set(enteteAuthorization(jeton)).send({ titre, description });
    assert.equal(res.status, 201);
    return res.body as { id: number; professeurId: number; titre: string; description: string | null; statut: string };
  }

  describe("POST /courses", () => {
    it("un professeur crée un cours en brouillon, rattaché à lui", async () => {
      const res = await request(app)
        .post("/courses")
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "  Algorithmique  ", description: "Les bases" });
      assert.equal(res.status, 201);
      assert.equal(res.body.titre, "Algorithmique");
      assert.equal(res.body.description, "Les bases");
      assert.equal(res.body.statut, "DRAFT");
      assert.equal(res.body.professeurId, prof1.id);
    });

    it("ignore les champs statut et professeurId envoyés par le client", async () => {
      const res = await request(app)
        .post("/courses")
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "Triche", statut: "PUBLISHED", professeurId: prof2.id });
      assert.equal(res.status, 201);
      assert.equal(res.body.statut, "DRAFT");
      assert.equal(res.body.professeurId, prof1.id);
    });

    it("la description est facultative", async () => {
      const res = await request(app)
        .post("/courses")
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "Sans description" });
      assert.equal(res.status, 201);
      assert.equal(res.body.description, null);
    });

    it("un administrateur peut créer un cours", async () => {
      const res = await request(app).post("/courses").set(enteteAuthorization(jetonAdmin)).send({ titre: "Cours admin" });
      assert.equal(res.status, 201);
    });

    it("refuse un titre absent, vide ou trop long (400)", async () => {
      for (const corps of [{}, { titre: "" }, { titre: "   " }, { titre: 42 }, { titre: "x".repeat(151) }]) {
        const res = await request(app).post("/courses").set(enteteAuthorization(jetonProf1)).send(corps);
        assert.equal(res.status, 400, JSON.stringify(corps));
      }
    });

    it("un apprenant ne peut pas créer de cours (403)", async () => {
      const res = await request(app).post("/courses").set(enteteAuthorization(jetonEleve)).send({ titre: "Interdit" });
      assert.equal(res.status, 403);
    });

    it("refuse sans token (401)", async () => {
      const res = await request(app).post("/courses").send({ titre: "Anonyme" });
      assert.equal(res.status, 401);
    });
  });

  describe("GET /courses/:id", () => {
    it("le propriétaire lit son cours", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app).get(`/courses/${cours.id}`).set(enteteAuthorization(jetonProf1));
      assert.equal(res.status, 200);
      assert.equal(res.body.id, cours.id);
    });

    it("404 si le cours n existe pas, 400 si l identifiant est invalide", async () => {
      const inconnu = await request(app).get("/courses/999999").set(enteteAuthorization(jetonProf1));
      assert.equal(inconnu.status, 404);
      const invalide = await request(app).get("/courses/abc").set(enteteAuthorization(jetonProf1));
      assert.equal(invalide.status, 400);
    });

    it("un autre professeur ne peut pas lire ce cours (403)", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app).get(`/courses/${cours.id}`).set(enteteAuthorization(jetonProf2));
      assert.equal(res.status, 403);
    });

    it("un administrateur peut le lire", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app).get(`/courses/${cours.id}`).set(enteteAuthorization(jetonAdmin));
      assert.equal(res.status, 200);
    });

    it("un apprenant (403) et un anonyme (401) sont refusés", async () => {
      const cours = await creerCours(jetonProf1);
      const eleve = await request(app).get(`/courses/${cours.id}`).set(enteteAuthorization(jetonEleve));
      assert.equal(eleve.status, 403);
      const anonyme = await request(app).get(`/courses/${cours.id}`);
      assert.equal(anonyme.status, 401);
    });
  });

  describe("PATCH /courses/:id", () => {
    it("le propriétaire modifie titre et description", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "Algorithmique avancée", description: "Nouvelle description" });
      assert.equal(res.status, 200);
      assert.equal(res.body.titre, "Algorithmique avancée");
      assert.equal(res.body.description, "Nouvelle description");
      const enBase = await Cours.findByPk(cours.id);
      assert.equal(enBase?.titre, "Algorithmique avancée");
    });

    it("peut ne modifier qu un seul champ", async () => {
      const cours = await creerCours(jetonProf1, "Titre fixe", "Ancienne");
      const res = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonProf1))
        .send({ description: "Seule la description change" });
      assert.equal(res.status, 200);
      assert.equal(res.body.titre, "Titre fixe");
      assert.equal(res.body.description, "Seule la description change");
    });

    it("ne permet pas de changer statut ni professeurId", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "Même cours", statut: "PUBLISHED", professeurId: prof2.id });
      assert.equal(res.status, 200);
      assert.equal(res.body.statut, "DRAFT");
      assert.equal(res.body.professeurId, prof1.id);
    });

    it("refuse un corps vide ou un titre vide (400)", async () => {
      const cours = await creerCours(jetonProf1);
      const vide = await request(app).patch(`/courses/${cours.id}`).set(enteteAuthorization(jetonProf1)).send({});
      assert.equal(vide.status, 400);
      const titreVide = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: " " });
      assert.equal(titreVide.status, 400);
    });

    it("un autre professeur ne peut pas modifier le cours (403) et rien ne change", async () => {
      const cours = await creerCours(jetonProf1, "Original");
      const res = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonProf2))
        .send({ titre: "Piraté" });
      assert.equal(res.status, 403);
      const enBase = await Cours.findByPk(cours.id);
      assert.equal(enBase?.titre, "Original");
    });

    it("un administrateur peut modifier n importe quel cours", async () => {
      const cours = await creerCours(jetonProf1);
      const res = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonAdmin))
        .send({ titre: "Corrigé" });
      assert.equal(res.status, 200);
      assert.equal(res.body.titre, "Corrigé");
    });

    it("404 si le cours n existe pas", async () => {
      const res = await request(app)
        .patch("/courses/999999")
        .set(enteteAuthorization(jetonProf1))
        .send({ titre: "X" });
      assert.equal(res.status, 404);
    });

    it("un apprenant (403) et un anonyme (401) sont refusés", async () => {
      const cours = await creerCours(jetonProf1);
      const eleve = await request(app)
        .patch(`/courses/${cours.id}`)
        .set(enteteAuthorization(jetonEleve))
        .send({ titre: "X" });
      assert.equal(eleve.status, 403);
      const anonyme = await request(app).patch(`/courses/${cours.id}`).send({ titre: "X" });
      assert.equal(anonyme.status, 401);
    });
  });
});

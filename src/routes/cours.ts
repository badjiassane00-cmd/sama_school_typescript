import { Request, Response } from "express";
import { app } from "../app.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { Cours } from "../models/index.js";
import { chargerCoursAutorise } from "../utils/cours.js";

const TITRE_MAX = 150;

function lireTexte(valeur: unknown) {
  if (typeof valeur !== "string") {
    return undefined;
  }
  return valeur.trim();
}

app.post("/courses", authenticate, authorize("TEACHER", "ADMIN"), async (req: Request, res: Response) => {
  const titre = lireTexte(req.body?.titre);
  const description = lireTexte(req.body?.description);

  if (!titre) {
    res.status(400).json({ message: "titre est obligatoire" });
    return;
  }
  if (titre.length > TITRE_MAX) {
    res.status(400).json({ message: `titre ne doit pas dépasser ${TITRE_MAX} caractères` });
    return;
  }

  const cours = await Cours.create({
    professeurId: res.locals.user.id,
    titre,
    description: description || null,
  });
  res.status(201).json(cours);
});

app.get("/courses/:id", authenticate, authorize("TEACHER", "ADMIN"), async (req: Request, res: Response) => {
  const cours = await chargerCoursAutorise(req, res);
  if (!cours) {
    return;
  }
  res.json(cours);
});

app.patch("/courses/:id", authenticate, authorize("TEACHER", "ADMIN"), async (req: Request, res: Response) => {
  const cours = await chargerCoursAutorise(req, res);
  if (!cours) {
    return;
  }

  const titre = lireTexte(req.body?.titre);
  const description = lireTexte(req.body?.description);

  if (titre === undefined && description === undefined) {
    res.status(400).json({ message: "Rien à modifier : envoyez titre et/ou description" });
    return;
  }
  if (titre !== undefined) {
    if (titre === "") {
      res.status(400).json({ message: "titre ne peut pas être vide" });
      return;
    }
    if (titre.length > TITRE_MAX) {
      res.status(400).json({ message: `titre ne doit pas dépasser ${TITRE_MAX} caractères` });
      return;
    }
    cours.titre = titre;
  }
  if (description !== undefined) {
    cours.description = description || null;
  }

  await cours.save();
  res.json(cours);
});

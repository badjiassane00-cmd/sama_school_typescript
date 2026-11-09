import { Request, Response } from "express";
import { Cours } from "../models/index.js";

export async function chargerCoursAutorise(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: "Identifiant de cours invalide" });
    return null;
  }

  const cours = await Cours.findByPk(id);
  if (!cours) {
    res.status(404).json({ message: "Cours introuvable" });
    return null;
  }

  const utilisateur = res.locals.user;
  if (utilisateur.role !== "ADMIN" && cours.professeurId !== utilisateur.id) {
    res.status(403).json({ message: "Ce cours appartient à un autre professeur" });
    return null;
  }

  return cours;
}

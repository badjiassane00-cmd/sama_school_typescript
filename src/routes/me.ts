import { Request, Response } from "express";
import { app } from "../app.js";
import { authenticate } from "../middlewares/authenticate.js";
import { Profile } from "../models/index.js";
import { findPublicUser } from "../utils/users.js";

app.get("/me", authenticate, async (req: Request, res: Response) => {
  res.json(await findPublicUser(res.locals.user.id));
});

app.patch("/me/profile", authenticate, async (req: Request, res: Response) => {
  const champs = ["firstName", "lastName", "phone", "bio"] as const;
  const changements: Partial<Record<(typeof champs)[number], string>> = {};

  for (const champ of champs) {
    const valeur = req.body?.[champ];
    if (typeof valeur === "string") {
      changements[champ] = valeur.trim();
    }
  }

  if (changements.firstName === "" || changements.lastName === "") {
    res.status(400).json({ message: "firstName et lastName ne peuvent pas être vides" });
    return;
  }

  await Profile.update(changements, { where: { userId: res.locals.user.id } });
  res.json(await findPublicUser(res.locals.user.id));
});

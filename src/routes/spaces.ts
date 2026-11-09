import { Request, Response } from "express";
import { app } from "../app.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

app.get("/teacher/dashboard", authenticate, authorize("TEACHER", "ADMIN"), (req: Request, res: Response) => {
  res.json({ message: "Espace professeur", user: res.locals.user });
});

app.get("/learner/dashboard", authenticate, authorize("LEARNER"), (req: Request, res: Response) => {
  res.json({ message: "Espace apprenant", user: res.locals.user });
});

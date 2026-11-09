import { Request, Response } from "express";
import { app } from "../app.js";
import { hello } from "../hello.js";
import "./auth.js";
import "./me.js";
import "./admin.js";
import "./spaces.js";
import "./cours.js";

app.get("/", (req: Request, res: Response) => {
  res.send(`<h1>${hello("Sama School")}</h1>`);
});

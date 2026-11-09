import { app } from "./app.js";
import { env } from "./config/env.js";
import "./routes/index.js";

app.listen(env.port, () => {
  console.log(`Serveur lancé sur http://localhost:${env.port} (${env.nodeEnv})`);
});

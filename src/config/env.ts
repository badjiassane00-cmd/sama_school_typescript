import dotenv from "dotenv";
import { Dialect } from "sequelize";

dotenv.config();

let nodeEnv = process.env.NODE_ENV;
if (nodeEnv !== "production") {
  nodeEnv = "development";
}

let port = Number(process.env.PORT);
if (!port) {
  port = 4000;
}

const requises = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "DB_DIALECT", "JWT_SECRET"];
for (const cle of requises) {
  if (!process.env[cle]) {
    throw new Error(`${cle} est absente du fichier .env`);
  }
}

let jwtExpiresIn = process.env.JWT_EXPIRES_IN;
if (!jwtExpiresIn) {
  jwtExpiresIn = "15m";
}

let refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS);
if (!refreshTokenDays) {
  refreshTokenDays = 7;
}

let loginMaxAttempts = Number(process.env.LOGIN_MAX_ATTEMPTS);
if (!loginMaxAttempts) {
  loginMaxAttempts = 5;
}

let loginWindowMinutes = Number(process.env.LOGIN_WINDOW_MINUTES);
if (!loginWindowMinutes) {
  loginWindowMinutes = 15;
}

export const env = {
  nodeEnv,
  port,
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn,
  refreshTokenDays,
  loginMaxAttempts,
  loginWindowMinutes,
  db: {
    host: process.env.DB_HOST as string,
    port: Number(process.env.DB_PORT),
    name: process.env.DB_NAME as string,
    user: process.env.DB_USER as string,
    password: process.env.DB_PASSWORD as string,
    dialect: process.env.DB_DIALECT as Dialect,
  },
};

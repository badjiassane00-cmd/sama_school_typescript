import { Cours } from "./Cours.js";
import { LoginLog } from "./LoginLog.js";
import { Profile } from "./Profile.js";
import { RefreshToken } from "./RefreshToken.js";
import { User } from "./User.js";

User.hasOne(Profile, { foreignKey: "userId", as: "profile", onDelete: "CASCADE" });
Profile.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(RefreshToken, { foreignKey: "userId", as: "sessions", onDelete: "CASCADE" });
RefreshToken.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(LoginLog, { foreignKey: "userId", as: "logins", onDelete: "SET NULL" });
LoginLog.belongsTo(User, { foreignKey: "userId", as: "user" });

User.hasMany(Cours, { foreignKey: "professeurId", as: "cours", onDelete: "CASCADE" });
Cours.belongsTo(User, { foreignKey: "professeurId", as: "professeur" });

export { Cours, LoginLog, Profile, RefreshToken, User };

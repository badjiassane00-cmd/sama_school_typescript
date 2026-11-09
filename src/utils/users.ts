import { Profile, User } from "../models/index.js";

export function findPublicUser(id: number) {
  return User.findByPk(id, { include: [{ model: Profile, as: "profile" }] });
}

export const ROLES = ["ADMIN", "TEACHER", "LEARNER"] as const;

export type Role = (typeof ROLES)[number];

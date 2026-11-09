export const STATUTS_COURS = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export type StatutCours = (typeof STATUTS_COURS)[number];

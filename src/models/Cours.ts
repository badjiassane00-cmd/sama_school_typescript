import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../config/database.js";
import { STATUTS_COURS, StatutCours } from "../config/statutsCours.js";

export class Cours extends Model<InferAttributes<Cours>, InferCreationAttributes<Cours>> {
  declare id: CreationOptional<number>;
  declare professeurId: number;
  declare titre: string;
  declare description: CreationOptional<string | null>;
  declare statut: CreationOptional<StatutCours>;
  declare creeLe: CreationOptional<Date>;
  declare modifieLe: CreationOptional<Date>;
}

Cours.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    professeurId: { type: DataTypes.INTEGER, allowNull: false },
    titre: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    statut: { type: DataTypes.ENUM(...STATUTS_COURS), allowNull: false, defaultValue: "DRAFT" },
    creeLe: DataTypes.DATE,
    modifieLe: DataTypes.DATE,
  },
  { sequelize, tableName: "cours", createdAt: "creeLe", updatedAt: "modifieLe" }
);

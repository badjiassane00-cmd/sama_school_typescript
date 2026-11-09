import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "../config/database.js";

export class LoginLog extends Model<InferAttributes<LoginLog>, InferCreationAttributes<LoginLog>> {
  declare id: CreationOptional<number>;
  declare userId: CreationOptional<number | null>;
  declare email: string;
  declare success: boolean;
  declare reason: string;
  declare ip: CreationOptional<string | null>;
  declare userAgent: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
}

LoginLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: false },
    success: { type: DataTypes.BOOLEAN, allowNull: false },
    reason: { type: DataTypes.STRING, allowNull: false },
    ip: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: "login_logs", updatedAt: false }
);

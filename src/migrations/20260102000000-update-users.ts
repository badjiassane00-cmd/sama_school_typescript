import { DataTypes, QueryInterface } from "sequelize";

export async function up(queryInterface: QueryInterface) {
  await queryInterface.removeColumn("users", "name");
  await queryInterface.addColumn("users", "role", {
    type: DataTypes.ENUM("ADMIN", "TEACHER", "LEARNER"),
    allowNull: false,
    defaultValue: "LEARNER",
  });
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.removeColumn("users", "role");
  await queryInterface.addColumn("users", "name", {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "",
  });
}

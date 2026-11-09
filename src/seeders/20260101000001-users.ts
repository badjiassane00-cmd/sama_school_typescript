import bcrypt from "bcryptjs";
import { QueryInterface, QueryTypes } from "sequelize";

const comptes = [
  { email: "admin@sama.sn", role: "ADMIN", firstName: "Admin", lastName: "Sama" },
  { email: "prof@sama.sn", role: "TEACHER", firstName: "Awa", lastName: "Diop" },
  { email: "eleve@sama.sn", role: "LEARNER", firstName: "Assane", lastName: "Fall" },
];

export async function up(queryInterface: QueryInterface) {
  const now = new Date();
  const hash = await bcrypt.hash("Password123!", 10);

  await queryInterface.bulkInsert(
    "users",
    comptes.map((c) => ({ email: c.email, password: hash, role: c.role, createdAt: now, updatedAt: now }))
  );

  const users = (await queryInterface.sequelize.query("SELECT id, email FROM users", {
    type: QueryTypes.SELECT,
  })) as { id: number; email: string }[];

  await queryInterface.bulkInsert(
    "profiles",
    comptes.map((c) => ({
      userId: users.find((u) => u.email === c.email)?.id,
      firstName: c.firstName,
      lastName: c.lastName,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export async function down(queryInterface: QueryInterface) {
  await queryInterface.bulkDelete("users", { email: comptes.map((c) => c.email) });
}

import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.poolState.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const managerEmail = process.env.SEED_MANAGER_EMAIL ?? "gestionnaire@ledgercapital.local";
  const managerPassword = process.env.SEED_MANAGER_PASSWORD ?? "change-me-please-1234";

  const existing = await prisma.user.findUnique({ where: { email: managerEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: managerEmail,
        name: "Gestionnaire",
        passwordHash: await bcrypt.hash(managerPassword, 12),
        role: "MANAGER",
      },
    });
    console.log(`Compte gestionnaire créé : ${managerEmail} / ${managerPassword}`);
    console.log("⚠️  Change ce mot de passe immédiatement en dehors du développement local.");
  } else {
    console.log(`Compte gestionnaire déjà existant : ${managerEmail}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

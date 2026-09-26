import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Permanent bootstrap admin — change the password via /auth/change-password
// immediately after first login, especially if this repository is public.
const ADMIN_USERNAME = 'ZEAIPC';
const ADMIN_PASSWORD = 'arman';
const SALT_ROUNDS = 12;

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  const existing = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });

  if (existing) {
    await prisma.user.update({
      where: { username: ADMIN_USERNAME },
      data: {
        passwordHash,
        role: Role.SUPER_ADMIN,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`Existing admin '${ADMIN_USERNAME}' updated.`);
    return;
  }

  await prisma.user.create({
    data: {
      username: ADMIN_USERNAME,
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`Permanent admin '${ADMIN_USERNAME}' created.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

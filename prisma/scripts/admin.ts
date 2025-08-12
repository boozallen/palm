import { PrismaClient, User } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createAuditor } from '../../server/auditor'; // requires absolute path

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const [, , email, password] = process.argv;

  if (!email) {
    throw new Error('An email address must be provided as a command line argument');
  }

  const existingUser: User | null = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'Admin' },
    });

    const auditor = createAuditor({});
    auditor.createAuditRecord({
      outcome: 'SUCCESS',
      description: `Updated user role to Admin: ${updatedUser.name}`,
      event: 'MODIFY_USER_ROLE',
    });
    return;
  }

  if (!password) {
    throw new Error('To create a new Admin user, both email and password must be provided as command line arguments.' +
      '\nIf you are trying to update a user to Admin, please double-check the email address and try again.');
  }

  const hashedPassword: string = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      hashedPassword,
      email,
      role: 'Admin',
    },
  });

  const auditor = createAuditor({});
  auditor.createAuditRecord({
    outcome: 'SUCCESS',
    description: `Created user with Admin role: ${user.name}`,
    event: 'CREATE_USER',
  });
}

main()
  .catch((e) => {
    const auditor = createAuditor({});
    auditor.createAuditRecord({
      outcome: 'ERROR',
      description: 'Failed to create or update a user to role of Admin.',
      event: 'MODIFY_USER_ROLE',
    });
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

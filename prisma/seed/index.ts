import { PrismaClient } from '@prisma/client';
import seedPrompts from './prompts';
import seedTags from './tags';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await seedTags(prisma);
  await seedPrompts(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

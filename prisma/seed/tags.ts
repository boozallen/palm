import { PrismaClient } from '@prisma/client';
// import { prompts } from './prompts-data';

export default async function seedTags(_prisma: PrismaClient) {
  // const seedData = prompts.flatMap(prompt => prompt.tags ? prompt.tags.map(tag => ({ tag })) : []);
  //
  // try {
  //   await prisma.tag.createMany({
  //     data: seedData,
  //     skipDuplicates: true,
  //   });
  // } catch (e) {
  //   console.error('Error seeding data', e);
  //   throw e;
  // } finally {
  //   await prisma.$disconnect();
  // }
}

import type { PrismaClient } from '@prisma/client';
import { prompts } from './prompts-data';

export default function seedPrompts(prisma: PrismaClient) {
  return Promise.all(
    prompts.map(
      ({ id: slug, tags, config, ...rest }) => prisma.prompt.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          tags: {
            create: tags.map(tag => ({ tag })),
          },
          ...config,
          ...rest,
        },
      })
    )
  );
}

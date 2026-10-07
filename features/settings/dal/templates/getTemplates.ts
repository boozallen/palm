import logger from '@/server/logger';
import db from '@/server/db';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

type TemplateListItem = {
  id: string;
  filename: string;
  createdAt: Date;
  updatedAt: Date;
};

export default async function getTemplates(): Promise<TemplateListItem[]> {
  try {
    return await db.artifactTemplate.findMany({
      select: {
        id: true,
        filename: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    logger.error('Error fetching templates', error);
    throw new Error(handlePrismaError(error));
  }
}

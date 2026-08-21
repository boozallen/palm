import logger from '@/server/logger';
import db from '@/server/db';
import { handlePrismaError } from '@/features/shared/errors/prismaErrors';

export default async function deleteTemplate(templateId: string): Promise<{ id: string }> {
  try {
    const deleted = await db.artifactTemplate.delete({
      where: { id: templateId },
      select: { id: true },
    });
    return deleted;
  } catch (error) {
    logger.error('Error deleting template', error);
    throw new Error(handlePrismaError(error));
  }
}

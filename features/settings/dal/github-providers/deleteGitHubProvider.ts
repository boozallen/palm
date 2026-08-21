import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteGitHubProvider(id: string): Promise<void> {
  try {
    await db.gitHubProvider.update({
      where: { id },
      data: {
        userGroups: { set: [] },
        deletedAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error deleting GitHub provider', { id, error });
    throw new Error('Error deleting GitHub provider');
  }
}

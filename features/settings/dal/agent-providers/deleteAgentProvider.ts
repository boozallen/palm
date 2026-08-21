import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteAgentProvider(id: string): Promise<void> {
  try {
    await db.agentProvider.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    logger.error('Error deleting agent provider', error);
    throw new Error('Error deleting agent provider');
  }
}

import db from '@/server/db';
import logger from '@/server/logger';

export default async function deleteWorkflowPrompts(promptIds: string[]): Promise<void> {
  if (promptIds.length === 0) {
    return;
  }
  try {
    await db.prompt.deleteMany({
      where: { id: { in: promptIds }, workflows: true },
    });
  } catch (error) {
    logger.error('Error deleting workflow prompts:', error);
    throw new Error('Error deleting workflow prompts');
  }
}

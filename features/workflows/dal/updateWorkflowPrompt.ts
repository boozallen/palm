import db from '@/server/db';
import logger from '@/server/logger';

export default async function updateWorkflowPrompt(
  promptId: string,
  instructions: string,
): Promise<void> {
  try {
    await db.prompt.update({
      where: { id: promptId },
      data: { instructions },
    });
  } catch (error) {
    logger.error('Error updating workflow prompt:', error);
    throw new Error('Error updating workflow prompt');
  }
}

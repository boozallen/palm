import { Prompt, PromptUtils } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

export default async function getPrompt(promptId: string): Promise<Prompt> {
  try {
    const dbPrompt = await db.prompt.findUnique({
      where: { id: promptId },
      include: { tags: true },
    });

    if (!dbPrompt) {
      logger.error(`Prompt not found: id: ${promptId}`);
      throw new Error('Prompt not found');
    }

    return PromptUtils.unmarshal(dbPrompt);
  } catch (error) {
    logger.error(`Error getting prompt: id: ${promptId}`, error);
    throw new Error('Error getting prompt');
  }
}

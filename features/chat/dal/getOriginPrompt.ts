import { OriginPrompt } from '@/features/chat/types/originPrompt';
import logger from '@/server/logger';
import db from '@/server/db';

export default async function getOriginPrompt(promptId: string): Promise<OriginPrompt> {
  let result = null;
  try {
    result = await db.prompt.findUnique({
      where: { id: promptId },
    });
  } catch (error) {
    // log detailed error
    logger.error(`Error getting origin prompt: PromptId: ${promptId}`, error);
    // throw user-friendly error
    throw new Error('Error getting origin prompt');
  }

  if (!result) {
    logger.error('Origin prompt not found in database');
    throw new Error('The origin prompt no longer exists');
  }

  return {
    id: result.id,
    creatorId: result.creatorId,
    title: result.title,
    description: result.description,
    instructions: result.instructions,
    example: result.example,
  };
}

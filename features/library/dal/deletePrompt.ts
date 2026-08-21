import db from '@/server/db';
import logger from '@/server/logger';

type DeletePromptResponse = {
  id: string;
};
export default async function deletePrompt(
  promptId: string
): Promise<DeletePromptResponse> {
  try {
    const deletionResult = await db.prompt.delete({
      where: { id: promptId },
    });
    return {
      id: deletionResult.id,
    };
  } catch (error) {
    logger.error(`Error deleting prompt from the database. Id: ${promptId}`, error);
    throw new Error('Error deleting prompt');
  }
}

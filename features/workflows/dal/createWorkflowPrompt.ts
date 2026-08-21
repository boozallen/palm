import db from '@/server/db';
import logger from '@/server/logger';

export type CreateWorkflowPromptParams = {
  title: string;
  instructions: string;
  model: string;
  temperature: number;
  creatorId: string;
};

export default async function createWorkflowPrompt({
  title,
  instructions,
  model,
  temperature,
  creatorId,
}: CreateWorkflowPromptParams): Promise<{ id: string }> {
  try {
    const prompt = await db.prompt.create({
      data: {
        title,
        instructions,
        model,
        temperature: temperature,
        topP: 0.5,
        summary: '',
        description: '',
        example: '',
        workflows: true,
        creatorId,
      },
      select: { id: true },
    });
    return { id: prompt.id };
  } catch (error) {
    logger.error('Error creating workflow prompt:', error);
    throw new Error('Error creating workflow prompt');
  }
}

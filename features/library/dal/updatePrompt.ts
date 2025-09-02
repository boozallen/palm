import { Prompt } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type UpdatePrompt = {
  id: string;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  example: string;
  model: string;
  randomness: number;
  repetitiveness: number;
  tags: string[];
}

/**
 * Updates a prompt in the database.
 * @param input - The updated prompt data.
 */
export default async function updatePrompt(input: UpdatePrompt): Promise<Prompt> {

  return db.$transaction(async (tx) => {
    try {

      // Find current prompt tags
      const currentPromptTags = await tx.promptTag.findMany({
        where: {
          promptId: input.id,
        },
      });

      const currentTagsSet = new Set(currentPromptTags.map(tag => tag.tag));
      const inputTagsSet = new Set(input.tags);

      // Find tags to delete and create
      const tagsToDelete = currentPromptTags.filter(tag => !inputTagsSet.has(tag.tag));
      const tagsToCreate = input.tags.filter(tag => !currentTagsSet.has(tag));

      // Update Prompt
      const updatedPrompt = await tx.prompt.update({
        where: {
          id: input.id,
        },
        data: {
          title: input.title,
          summary: input.summary,
          description: input.description,
          instructions: input.instructions,
          example: input.example,
          model: input.model,
          randomness: input.randomness,
          repetitiveness: input.repetitiveness,
          tags: {
            deleteMany: tagsToDelete.map(tag => ({ tag: tag.tag })),
            createMany: {
              data: tagsToCreate.map(tag => ({ tag })),
            },
          },
        },
        include: {
          tags: true,
        },
      });

      return {
        id: updatedPrompt.id,
        creatorId: updatedPrompt.creatorId,
        title: updatedPrompt.title,
        summary: updatedPrompt.summary,
        description: updatedPrompt.description,
        instructions: updatedPrompt.instructions,
        example: updatedPrompt.example,
        tags: updatedPrompt.tags.map(tag => tag.tag),
        config: {
          model: updatedPrompt.model,
          randomness: updatedPrompt.randomness,
          repetitiveness: updatedPrompt.repetitiveness,
        },
      };
    } catch (error) {
      logger.error(`Error updating prompt: id: ${input.id}`, error);
      throw new Error('Error updating prompt');
    }
  });
}

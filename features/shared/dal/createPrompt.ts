import { Prompt, PromptFormValues } from '@/features/shared/types';
import db from '@/server/db';
import logger from '@/server/logger';

type CreatePromptInput = {
  prompt: PromptFormValues;
};

export default async function createPrompt(
  input: CreatePromptInput
): Promise<Prompt> {
  try {
    const { tags, config, ...otherValues } = input.prompt;

    const res = await db.prompt.create({
      data: {
        tags: { create: tags.map((tag) => ({ tag })) },
        ...config,
        ...otherValues,
      },
      include: {
        tags: true,
      },
    });

    return {
      id: res.id,
      creatorId: res.creatorId,
      title: res.title,
      summary: res.summary,
      description: res.description,
      instructions: res.instructions,
      example: res.example,
      tags: res.tags.map(({ tag }) => tag),
      config: {
        randomness: res.randomness,
        model: res.model,
        repetitiveness: res.repetitiveness,
        bestOf: res.bestOf,
        frequencyPenalty: res.frequencyPenalty,
        presencePenalty: res.presencePenalty,
      },
    };
  } catch (error) {
    logger.error('Error creating prompt', error);
    throw new Error('Error creating prompt');
  }
}

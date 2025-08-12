import { AIFactory } from '@/features/ai-provider';
import getFirstAvailableOpenAiModel from '@/features/settings/dal/getFirstAvailableOpenAiModel';

export const embedContent = async (userId: string, content: string) => {
  const openAiModel = await getFirstAvailableOpenAiModel();

  if (!openAiModel) {
    throw new Error('An OpenAI provider must be configured and available to create embeddings');
  }

  const factory = new AIFactory({ userId });
  const ai = await factory.buildSystemSource(openAiModel.id);

  const { embeddings } = await ai.source.createEmbeddings([content], {
    model: ai.model.externalId,
    randomness: 0.2,
    repetitiveness: 0.5,
  });

  return { embeddings };
};

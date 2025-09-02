import { AIFactory } from '@/features/ai-provider/factory';
import getFirstAvailableBedrockModel from '@/features/settings/dal/ai-providers/getFirstAvailableBedrockModel';

export const embedContent = async (content: string | string[], userId: string) => {
  const bedrockModel = await getFirstAvailableBedrockModel();
  if (!bedrockModel) {
    throw new Error('No Bedrock AI provider and model configured. Please configure a Bedrock AI provider first.');
  }

  const factory = new AIFactory({ userId });
  
  const { source } = await factory.buildUserSource(bedrockModel.id);

  const contentArray = Array.isArray(content) ? content : [content];

  const { embeddings } = await source.createEmbeddings(contentArray, {
    model: '', 
    randomness: 0.2,
    repetitiveness: 0.5,
    bestOf: 1,
    frequencyPenalty: 0,
    presencePenalty: 0,
  });

  return { embeddings };
};

import { AiProviderType } from './ai-provider'; 
import { z } from 'zod';

export type SelectOption = {
  value: string,
  label: string,
}

export type Checkbox = {
  checked: boolean;
  name: string;
};

export const apiKeySchema = z.string().min(1, 'An API key is required').max(200, 'An API Key cannot be longer than 200 characters');
export const apiEndpointSchema = z.string().min(1, 'An API endpoint is required').max(100, 'An API endpoint cannot be longer than 100 characters');
export const bedrockConfigSchema = {
  accessKeyId: z.string(),
  secretAccessKey: z.string(),
  sessionToken: z.string(),
  region: z.string(),
};

//The following creates a conditional schema for validation based on the AI Provider
export const generateConditionalSchema = (aiProvider: SelectOption, baseSchema: z.ZodObject<{ aiProvider: z.ZodNumber; }, 'strip', z.ZodTypeAny, { aiProvider: number; }, { aiProvider: number; }>) => {
  switch (aiProvider.value) {
    case AiProviderType.OpenAi.toString():
    case AiProviderType.Anthropic.toString():
    case AiProviderType.Gemini.toString():
      return baseSchema.extend({
        apiKey: apiKeySchema,
      });
    case AiProviderType.AzureOpenAi.toString():
      return baseSchema.extend({
        apiKey: apiKeySchema,
        apiEndpoint: apiEndpointSchema,
      });
    case AiProviderType.Bedrock.toString():
      return baseSchema.extend(bedrockConfigSchema);
    default:
      return baseSchema;
  }
};

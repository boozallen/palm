import { z } from 'zod';
import { SelectOption, generateConditionalSchema } from './forms';

export enum AiProviderType {
  OpenAi = 1,
  AzureOpenAi = 2,
  Bedrock = 3,
  Anthropic = 5,
  Gemini = 6,
}

export const AiProviderLabels: Record<AiProviderType, string> = {
  [AiProviderType.OpenAi]: 'OpenAI',
  [AiProviderType.AzureOpenAi]: 'Azure OpenAI',
  [AiProviderType.Bedrock]: 'Amazon Bedrock',
  [AiProviderType.Anthropic]: 'Anthropic',
  [AiProviderType.Gemini]: 'Gemini',
};

export const AiProvidersSelectInputOptions: SelectOption[] = Object.entries(
  AiProviderLabels,
)
  .filter(([key, _]) => !isNaN(Number(key)))
  .map(([key, value]) => ({
    value: key,
    label: value,
  }));

const baseAiProviderSchema = z.object({
  aiProvider: z.coerce.number().min(1, 'An AI Provider is required'),
  label: z.string().min(1, 'A label is required'),
  inputCostPerMillionTokens: z
    .number()
    .gte(0, 'Input token cost cannot be less than $0.00')
    .lte(1000, 'Input token cost should not exceed $1,000.00')
    .optional(),
  outputCostPerMillionTokens: z
    .number()
    .gte(0, 'Output token cost cannot be less than $0.00')
    .lte(1000, 'Output token cost should not exceed $1,000.00')
    .optional(),
});

export const generateConditionalAiProviderSchema = (
  aiProvider: SelectOption,
) => {
  return generateConditionalSchema(aiProvider, baseAiProviderSchema);
};

export const modelSchema = z.object({
  name: z.string().min(1, 'Model name cannot be empty'),
  externalId: z.string().min(1, 'External ID cannot be empty'),
  costPerMillionInputTokens: z.number(),
  costPerMillionOutputTokens: z.number(),
});

export type ModelFormValues = z.infer<typeof modelSchema>;

export type Provider = {
  id: string;
  typeId: AiProviderType;
  label: string;
  configTypeId: AiProviderType;
  config: ProviderConfig;
  costPerInputToken: number;
  costPerOutputToken: number;
  createdAt: Date;
  updatedAt: Date;
};

export type AvailableProvider = Omit<Provider, 'config' | 'configTypeId'>;

export type ProviderConfig = {
  id: string;
} & (
    OpenAiConfig |
    AzureOpenAiConfig |
    AnthropicConfig |
    GeminiConfig |
    BedrockConfig
  );

export type OpenAiConfig = {
  type: AiProviderType.OpenAi;
  apiKey: string;
  orgKey: string;
};

export function newOpenAiConfig(apiKey: string, orgKey: string): OpenAiConfig {
  return {
    type: AiProviderType.OpenAi,
    apiKey,
    orgKey,
  };
}

export type AzureOpenAiConfig = {
  type: AiProviderType.AzureOpenAi;
  apiKey: string;
  apiEndpoint: string;
  deploymentId: string;
};

export function newAzureOpenAiConfig(
  apiKey: string,
  apiEndpoint: string,
  deploymentId: string,
): AzureOpenAiConfig {
  return {
    type: AiProviderType.AzureOpenAi,
    apiKey,
    apiEndpoint,
    deploymentId,
  };
}

export type AnthropicConfig = {
  type: AiProviderType.Anthropic;
  apiKey: string;
};

export function newAnthropicConfig(apiKey: string): AnthropicConfig {
  return {
    type: AiProviderType.Anthropic,
    apiKey,
  };
}

export type GeminiConfig = {
  type: AiProviderType.Gemini;
  apiKey: string;
};

export function newGeminiConfig(apiKey: string): GeminiConfig {
  return {
    type: AiProviderType.Gemini,
    apiKey,
  };
}

export type BedrockConfig = {
  type: AiProviderType.Bedrock;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
};

export function newBedrockConfig(
  accessKeyId: string,
  secretAccessKey: string,
  region: string,
  sessionToken?: string,
): BedrockConfig {
  return {
    type: AiProviderType.Bedrock,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region,
  };
}

type ConfigWithApiEndpoint = {
  apiEndpoint: string;
};

export function hasApiEndpoint(config: any): config is ConfigWithApiEndpoint {
  return 'apiEndpoint' in config;
}

export function isBedrockConfig(config: any): config is BedrockConfig {
  return 'region' in config;
}

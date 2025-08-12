import { z } from 'zod';
import { apiEndpointSchema, apiKeySchema, SelectOption } from './forms';

export enum KbProviderType {
  KbProviderPalm = 1,
  KbProviderBedrock = 3,
}

export const KbProviderLabels: Record<KbProviderType, string> = {
  [KbProviderType.KbProviderPalm]: 'PALM',
  [KbProviderType.KbProviderBedrock]: 'Bedrock',
};

export const KbProvidersSelectInputOptions: SelectOption[] = Object.entries(KbProviderLabels)
  .filter(([key, _]) => !isNaN(Number(key)))
  .map(([key, value]) => ({
    value: key,
    label: value,
  }));

const baseKbProviderSchema = z.object({
  label: z.string().min(1, 'A label is required'),
  kbProviderType: z.coerce.number().min(1, 'A KB Provider is required'),
});

// Provider-specific config schemas
export const KbProviderPalmConfigSchema = z.object({
  apiKey: apiKeySchema,
  apiEndpoint: apiEndpointSchema,
});

export const kbProviderBedrockConfigSchema = z
  .object({
    accessKeyId: z.string(),
    secretAccessKey: z.string(),
    sessionToken: z.string(),
    region: z.string(),
  });

export const conditionalKbProviderSchema = (kbProvider: KbProviderType) => {
  switch (kbProvider) {
    case KbProviderType.KbProviderPalm:
      return baseKbProviderSchema.extend({
        config: KbProviderPalmConfigSchema,
      });
    case KbProviderType.KbProviderBedrock:
      return baseKbProviderSchema.extend({
        config: kbProviderBedrockConfigSchema,
      });
    default:
      return baseKbProviderSchema;
  }
};

// Combined provider config schema
export const kbProviderConfigSchema = z.union([
  KbProviderPalmConfigSchema,
  kbProviderBedrockConfigSchema,
]);

export const sanitizedKbProviderPalmConfigSchema = KbProviderPalmConfigSchema.omit({ apiKey: true });
export const sanitizedKbProviderBedrockConfigSchema = kbProviderBedrockConfigSchema.omit({
  accessKeyId: true,
  secretAccessKey: true,
  sessionToken: true,
});

export const sanitizedKbProviderConfigSchema = z.union([
  sanitizedKbProviderPalmConfigSchema,
  sanitizedKbProviderBedrockConfigSchema,
]);

// Knowledge Base Provider schemas
export const kbProviderFormSchema = baseKbProviderSchema.extend({
  config: kbProviderConfigSchema,
});

export const kbProviderSchema = kbProviderFormSchema.extend({
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// Knowledge Base schemas
export const knowledgeBaseFormSchema = z.object({
  label: z.string().trim().min(1, 'A label is required'),
  externalId: z.string().trim().min(1, 'An external ID is required'),
});

export const knowledgeBaseSchema = knowledgeBaseFormSchema.extend({
  id: z.string().uuid(),
  kbProviderId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type KbProviderForm = z.infer<typeof kbProviderFormSchema>;
export type KbProvider = z.infer<typeof kbProviderSchema>;
export type KbProviderConfig = z.infer<typeof kbProviderConfigSchema>;
export type SanitizedKbProviderConfig = z.infer<typeof sanitizedKbProviderConfigSchema>;
export type PalmSchema = z.infer<typeof KbProviderPalmConfigSchema>
export type BedrockSchema = z.infer<typeof kbProviderBedrockConfigSchema>

export type KnowledgeBaseForm = z.infer<typeof knowledgeBaseFormSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;

export type UserKnowledgeBase = {
  id: string;
  label: string;
  kbProviderId: string;
  kbProviderLabel: string;
};

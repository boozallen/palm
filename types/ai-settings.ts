import { z } from 'zod';

export const AiSettingsSchema = z.object({
  temperature: z.number().min(0).max(1),
  model: z.string().min(1, 'A model is required'),
  topP: z.number().min(0).max(1),
  frequencyPenalty: z.number().nullable().optional(),
  presencePenalty: z.number().nullable().optional(),
  sessionId: z.string().optional(),
  maxTokens: z.number().positive().optional(),
});

export type AiSettings = z.infer<typeof AiSettingsSchema>;

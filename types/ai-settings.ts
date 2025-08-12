import { z } from 'zod';

export const AiSettingsSchema = z.object({
  randomness: z.number().min(0).max(1),
  model: z.string().min(1, 'A model is required'),
  repetitiveness: z.number().min(0).max(1),
  bestOf: z.number().nullable().optional(),
  frequencyPenalty: z.number().nullable().optional(),
  presencePenalty: z.number().nullable().optional(),
});

export type AiSettings = z.infer<typeof AiSettingsSchema>;

import { z } from 'zod';

export const generatePromptInstructionsSchema = z.object({
  prompt: z.string().min(3),
});

export type GeneratePromptInstructions = z.infer<typeof generatePromptInstructionsSchema>;

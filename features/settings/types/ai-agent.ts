import { z } from 'zod';

export const policyForm = z.object({
  title: z.string().trim().min(1, { message: 'Title is required' }),
  content: z.string().trim().min(1, { message: 'Content is required' }),
  requirements: z.string().trim().min(1, { message: 'Requirements are required' }),
});

export type PolicyForm = z.infer<typeof policyForm>;

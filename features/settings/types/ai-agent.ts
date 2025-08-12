import { AiAgentLabels, SelectOption } from '@/features/shared/types';
import { z } from 'zod';

export const policyForm = z.object({
  title: z.string().trim().min(1, { message: 'Title is required' }),
  content: z.string().trim().min(1, { message: 'Content is required' }),
  requirements: z.string().trim().min(1, { message: 'Requirements are required' }),
});

export type PolicyForm = z.infer<typeof policyForm>;

export const AiAgentSelectInputOptions: SelectOption[] = Object
  .entries(AiAgentLabels)
  .filter(([key, _]) => !isNaN(Number(key)))
  .map(([key, value]) => ({
    value: key,
    label: value,
  }));

export const agentForm = z.object({
  name: z.string().trim().min(1, 'Agent name is required'),
  description: z.string().trim().min(1, 'Description is required'),
  type: z.coerce.number().min(1, 'Agent type is required'),
});

export type AgentForm = z.infer<typeof agentForm>;

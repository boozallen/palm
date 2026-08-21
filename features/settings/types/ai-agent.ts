import { AiAgentLabels, SelectOption } from '@/features/shared/types';
import { z } from 'zod';

export const policyForm = z.object({
  title: z.string().trim().min(1, { message: 'Title is required' }),
  content: z.string().trim().min(1, { message: 'Content is required' }),
  requirements: z.string().trim().min(1, { message: 'Requirements are required' }),
});

export type PolicyForm = z.infer<typeof policyForm>;

export const checklistItemForm = z.object({
  category: z.string().trim().min(1, { message: 'Category is required' }),
  item: z.string().trim().min(1, { message: 'Checklist item is required' }),
  sortOrder: z.coerce.number().min(0, { message: 'Sort order must be 0 or greater' }),
});

export type ChecklistItemForm = z.infer<typeof checklistItemForm>;

export const AiAgentSelectInputOptions: SelectOption[] = Object
  .entries(AiAgentLabels)
  .filter(([key, _]) => !isNaN(Number(key)))
  .map(([key, value]) => ({
    value: key,
    label: value,
  }));

export const agentForm = z.object({
  label: z.string().trim().min(1, 'Agent label is required'),
  description: z.string().trim().min(1, 'Description is required'),
  type: z.coerce.number().min(1, 'Agent type is required'),
});

export type AgentForm = z.infer<typeof agentForm>;

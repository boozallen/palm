import { AiSettings, AiSettingsSchema } from '@/types';
import { z } from 'zod';
import { Prompt as DBPrompt, PromptTag as DBPromptTag } from '@prisma/client';
import { promptTagSchema } from '@/features/shared/types/prompt-tag';

export const PromptSchema = z.object({
  creatorId: z.string().nullable(),
  title: z.string().min(3, 'A title cannot be shorter than 3 characters').max(100, 'A title cannot be longer than 100 characters')
    .refine(value => (/[^\s]{3,}/.test(value.replaceAll(' ', ''))), { message: 'A title cannot contain less than 3 non-space characters' }),
  summary: z.string().min(1, 'A summary is required').max(255, 'a summary cannot be longer than 255 characters'),
  description: z.string().min(1, 'A description is required').max(2048, 'A description cannot be longer than 2048 characters'),
  instructions: z.string().min(1, 'Instructions are required'),
  example: z.string().min(1, 'An example is required'),
  tags: z.array(promptTagSchema).max(3, 'A prompt cannot have more than 3 tags'),
  config: AiSettingsSchema,
});

export type PromptFormValues = z.infer<typeof PromptSchema>;

export type Prompt = {
  id: string;
  creatorId: string | null;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  example: string;
  tags: string[];
  config: AiSettings;
};

export function newPrompt(prompt: Partial<PromptFormValues>): PromptFormValues {
  return {
    creatorId: prompt.creatorId ?? null,
    title: prompt.title ?? '',
    summary: prompt.summary ?? '',
    description: prompt.description ?? '',
    instructions: prompt.instructions ?? '',
    example: prompt.example ?? '',
    tags: prompt.tags ?? [],
    config: prompt.config ?? {
      randomness: 0.5,
      model: '',
      repetitiveness: 0.5,
    },
  };
}

export namespace PromptUtils {
  type DBPromptWithTags = DBPrompt & { tags?: DBPromptTag[] };
  export function unmarshal(dbPrompt: DBPromptWithTags): Prompt {
    const {
      // tags need to be handled specially
      tags,
      // properties of config
      model, randomness, repetitiveness, bestOf,
      // the rest of the props map cleanly
      ...rest
    } = dbPrompt;

    return {
      config: { model, randomness, repetitiveness, bestOf },
      // Parse tags to match the promptTagSchema
      tags: (tags ?? []).map((tag) => tag.tag.trim().toLowerCase().replace(/\s+/g, '-')),
      ...rest,
    };
  }
}

export const runPromptFormSchema = z.object({
  example: z.string().min(1, { message: 'An example is required' }),
  instructions: z.string().min(1, { message: 'Instructions are required' }),
  config: AiSettingsSchema,
});

export type RunPromptForm = z.infer<typeof runPromptFormSchema>;

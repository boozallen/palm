import { z } from 'zod';

export type PromptTag = {
  promptId: string;
  tag: string;
};

export const promptTagSchema = z.string()
  .min(1, 'A tag cannot be empty')
  .max(20, 'A tag cannot exceed 20 characters')
  // tags are lower case and hyphenated
  .transform((val) => val.trim().toLocaleLowerCase().replace(/[\s-]+/g, '-'))
  // regex to ensure alphanumeric and hyphenated
  .refine((val) => /^[a-z0-9-]+$/.test(val), 'Tags must be alphanumeric.');

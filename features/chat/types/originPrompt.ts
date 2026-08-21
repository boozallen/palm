import { Prompt } from '@/features/shared/types';

export type OriginPrompt = Pick<Prompt, 'id' | 'creatorId' | 'title' | 'description' | 'instructions' | 'example'>

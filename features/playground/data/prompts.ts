import { Prompt } from '@/features/shared/types';

export const prompts: Prompt[] = [
  {
    id: 'playground-prompt',
    creatorId: null,
    title: 'Playground Prompt',
    summary: 'Sumbit user\'s playground prompt to user\'s first selected model',
    description: 'user playground prompt and selected model',
    instructions: '{req.exampleInput}',
    tags: ['Service'],
    example: 'function add(x, y) { return x + y; };',
    config: {
      randomness: 0.5,
      repetitiveness: 1,
      model: '',
    },
  },
];

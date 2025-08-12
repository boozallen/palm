import { Prompt } from '@/features/shared/types';

export const prompts: Prompt[] = [
  {
    id: 'generate-prompt',
    creatorId: null,
    title: 'Generate Prompt',
    summary: 'Develop powerful prompts with the help of AI',
    description: 'placeholder description',
    instructions: `Persona: You are an expert in prompt engineering. Your task is to generate a prompt based on the user's input: "{req.prompt}".

Instructions: 
1. The prompt you generate will be formatted in two sections: Persona and Instructions.
2. The "Persona" section must only include background and expertise relevant to the user's input, and not mention meta concepts such as "prompts", etc. Use language such as "You are ..." and "You are an expert in ...".
3. The "Instructions" section must be an ordered list of the steps the prompt should take to generate a response based on the user's input, and closely tailored to the user's specific request.
    `,
    tags: ['Service'],
    example: '',
    config: {
      randomness: 0.25,
      repetitiveness: 0.25,
      model: '',
      bestOf: 3,
    },
  },
];

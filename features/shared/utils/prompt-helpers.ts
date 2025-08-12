import { Prompt } from '@/features/shared/types';
import slugify from 'slugify';

export function getPromptById(prompts: any, id: string): Prompt {
  return prompts.find((prompt: Prompt) => prompt.id === id);
}

export function insertRequestValuesIntoPrompt(requestValues: Record<string, string>, prompt: string) {
  Object.keys(requestValues).forEach((key) => {
    prompt = prompt.replaceAll(`{req.${key}}`, requestValues[key]);
  });
  return prompt;
}

export function insertExampleInputIntoInstructionsInput(example: string, instructions: string): string {
  return instructions + '\n\n' + example;
}

export function generatePromptSlug(promptTitle: string) {
  return slugify(promptTitle, { lower: true, strict: true });
}

export function generatePromptUrl(promptTitle: string, promptId: string){
  return `/library/${generatePromptSlug(promptTitle)}/${promptId}`;
}

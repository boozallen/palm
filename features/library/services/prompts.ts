import { AiSettings } from '@/types';
import {
  getPromptById,
  insertRequestValuesIntoPrompt,
} from '@/features/shared/utils';
import { prompts } from '../data';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { AIFactory } from '@/features/ai-provider';
import { Prompt } from '@/features/shared/types';

export type RunPromptRequest = {
  instructions: string;
  config: AiSettings;
};

export type GeneratePromptRequest = {
  prompt: string;
  model: string;
};

export class PromptService {
  constructor(protected aiFactory: AIFactory) {}

  async runPrompt(req: RunPromptRequest): Promise<AiResponse> {
    const ai = await this.aiFactory.buildUserSource(req.config.model);
    const response = await ai.source.completion(req.instructions, {
      ...req.config,
      model: ai.model.externalId,
    });
    return response;
  }

  async generatePrompt(prompt: string): Promise<AiResponse> {
    const promptTemplate = getPromptById(prompts, 'generate-prompt');
    return await this.handleSystemPrompt(prompt, promptTemplate);
  }

  async handleSystemPrompt(inputPrompt: string, template: Prompt): Promise<AiResponse> {
    const prompt = insertRequestValuesIntoPrompt({ prompt: inputPrompt }, template.instructions);
    const config = template.config;

    const ai = await this.aiFactory.buildSystemSource();
    const response = await ai.source.completion(prompt, {
      ...config,
      model: ai.model.externalId,
    });
    return response;
  }
}


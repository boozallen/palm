import { prompts } from '@/features/playground/data';
import {
  getPromptById,
  insertRequestValuesIntoPrompt,
} from '@/features/shared/utils';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { AiSettings } from '@/types';
import { AIFactory } from '@/features/ai-provider';

export type PlaygroundPromptRequest = {
  exampleInput: string;
};

export class PlaygroundService {
  constructor(protected aiFactory: AIFactory) {
  }

  async playgroundPrompt(req: PlaygroundPromptRequest, reqConfig: AiSettings): Promise<AiResponse> {
    const promptTemplate = getPromptById(prompts, 'playground-prompt');
    const prompt = insertRequestValuesIntoPrompt(req, promptTemplate.instructions);

    const ai = await this.aiFactory.buildUserSource(reqConfig.model);
    return await ai.source.completion(prompt, {
      ...reqConfig,
      model: ai.model.externalId,
    });
  }

}

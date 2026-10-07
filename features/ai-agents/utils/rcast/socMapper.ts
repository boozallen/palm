import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import { prompts as rcastPrompts } from '@/features/ai-agents/data/rcast/prompts';
import {
  getPromptById,
  insertRequestValuesIntoPrompt,
} from '@/features/shared/utils/prompt-helpers';
import { logger } from '@/server/logger';

export type SocMappingResult = {
  code: string;
  title: string;
};

export function parseLlmResponse(responseText: string): SocMappingResult | null {
  try {
    let cleaned = responseText.trim();

    if (cleaned.startsWith('```')) {
      cleaned = cleaned
        .replace(/```[a-z]*\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
    }

    const firstLine = cleaned.split('\n')[0].trim();
    const parts = firstLine.split('|');

    if (parts.length !== 2) {
      logger.warn('LLM response not in expected CODE|TITLE format', { responseText, firstLine });
      return null;
    }

    const code = parts[0].trim();
    const title = parts[1].trim();

    const socPattern = /^\d{2}-\d{4}\.\d{2}$/;
    if (!socPattern.test(code)) {
      logger.warn('Invalid SOC code format in LLM response', { code, responseText });
      return null;
    }

    if (!title) {
      logger.warn('Empty title in LLM response', { responseText });
      return null;
    }

    return { code, title };
  } catch (error) {
    logger.error('Error parsing LLM response', { responseText, error });
    return null;
  }
}

export async function mapLaborCategoryToSoc(
  completionAdapter: AiFactoryCompletionAdapter,
  laborCategory: string,
  _experienceLevel?: string
): Promise<SocMappingResult | null> {
  const prompt = getPromptById(rcastPrompts, 'soc-code-mapping');

  if (!prompt) {
    logger.error('SOC code mapping prompt not found');
    return null;
  }

  const filledPrompt = insertRequestValuesIntoPrompt(
    { laborCategory },
    prompt.instructions
  );

  try {
    const response = await completionAdapter.complete({ prompt: filledPrompt });

    if (!response.text) {
      logger.warn('Empty response from LLM for SOC mapping', { laborCategory });
      return null;
    }

    const result = parseLlmResponse(response.text);

    if (!result) {
      logger.warn('Failed to parse LLM response', {
        laborCategory,
        response: response.text,
      });
      return null;
    }

    logger.info('Successfully mapped labor category to SOC code', {
      laborCategory,
      socCode: result.code,
      socTitle: result.title,
    });

    return result;
  } catch (error) {
    logger.error('Error mapping labor category to SOC', { laborCategory, error });
    return null;
  }
}

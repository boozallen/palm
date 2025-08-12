import { AiSettings } from '@/types';
import { compliancePrompts } from '@/features/ai-agents/data/prompts';
import { PromptManager as IPromptManager } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { getPromptById, insertRequestValuesIntoPrompt } from '@/features/shared/utils';
import logger from '@/server/logger';

export class PromptManager implements IPromptManager {
  private readonly aiSettings: AiSettings;
  private summary: string | undefined;
  constructor(
    private readonly ai: BuildResult,
    private readonly policyContent: string,
    private readonly instructions: string,
    private readonly policyRequirements: string,
  ) {
    this.aiSettings = {
      model: ai.model.externalId,
      randomness: 0.0,
      repetitiveness: 1,
      bestOf: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
    };
  }
  async getCompliancePrompt(): Promise<string> {
    if (!this.summary) {
      this.summary = await this.summarizePolicy();
    }
    const promptId = 'compliance-check';
    const compliancePrompt = getPromptById(compliancePrompts, promptId);
    if (!compliancePrompt) {
      throw new Error('Compliance check prompt not found');
    }
    let values: Record<string, string>;

    if (!this.policyRequirements) {
      throw new Error('Unable to process policy requirements');
    } else {
      values = {
        requirements: this.policyRequirements,
        content: this.policyContent,
      };
    }

    let prompt = insertRequestValuesIntoPrompt(
      {
        ...values,
        summary: this.summary,
      },
      compliancePrompt.instructions
    );
    if (this.instructions.trim() !== '') {
      prompt = `${prompt}\n\nADDITIONAL INSTRUCTIONS PROVIDED BY USER:\n\n${this.instructions}`;
    }
    return prompt;

  }
  async getConsensusPrompt(input1: string, input2: string, input3: string): Promise<string> {
    if (!this.summary) {
      this.summary = await this.summarizePolicy();
    }
    const consensusPrompt = getPromptById(compliancePrompts, 'consensus-check');
    if (!consensusPrompt) {
      throw new Error('Consensus check prompt not found');
    }
    let prompt = insertRequestValuesIntoPrompt(
      {
        summary: this.summary,
        input1,
        input2,
        input3,
      },
      consensusPrompt.instructions
    );
    if (this.instructions.trim() !== '') {
      prompt = `${prompt}\n\nADDITIONAL INSTRUCTIONS PROVIDED BY USER:\n\n${this.instructions}`;
    }

    return prompt;
  }
  private async summarizePolicy(): Promise<string> {
    const summaryPrompt = getPromptById(compliancePrompts, 'summarize-policy');
    if (!summaryPrompt) {
      throw new Error('Summary prompt not found');
    }
    const prompt = insertRequestValuesIntoPrompt(
      { policy: this.policyContent },
      summaryPrompt.instructions
    );

    try {
      const response = await this.ai.source.completion(
        prompt,
        this.aiSettings,
      );
      return response.text.trim();
    } catch (error) {
      logger.error('Error summarizing policy', error);
      throw new Error('Error summarizing policy');
    }

  }
}

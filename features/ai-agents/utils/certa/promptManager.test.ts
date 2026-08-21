import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';
import { PromptManager } from './promptManager';
import {
  getPromptById,
  insertRequestValuesIntoPrompt,
} from '@/features/shared/utils';
import logger from '@/server/logger';

jest.mock('@/features/shared/utils', () => ({
  getPromptById: jest.fn(),
  insertRequestValuesIntoPrompt: jest.fn(),
}));

describe('PromptManager', () => {
  const completion = jest.fn().mockResolvedValue({
    text: 'completion',
  });
  const policy = 'This is a test policy';
  const instructions = 'These are test instructions';
  const requirements = 'These are test requirements';
  const modelId = 'test-model';
  let promptManager: PromptManager;
  const ai: BuildResult = {
    model: {
      externalId: modelId,
    },
    source: {
      completion,
    },
  } as unknown as BuildResult;
  const mockSummaryPrompt = {
    id: 'summarize-policy',
    instructions: 'Summary prompt template',
    config: {},
  };
  const mockCompliancePrompt = {
    id: 'compliance-check',
    instructions: 'Compliance prompt template',
    config: {},
  };
  const mockConsensusPrompt = {
    id: 'consensus-check',
    instructions: 'Consensus prompt template',
    config: {},
  };
  beforeEach(() => {
    jest.clearAllMocks();
    promptManager = new PromptManager(ai, policy, instructions, requirements);
    (getPromptById as jest.Mock).mockImplementation((prompts, id) => {
      switch (id) {
        case 'summarize-policy':
          return mockSummaryPrompt;
        case 'compliance-check':
          return mockCompliancePrompt;
        case 'consensus-check':
          return mockConsensusPrompt;
        default:
          return null;
      }
    });
    (insertRequestValuesIntoPrompt as jest.Mock).mockImplementation(
      (values) => `Generated prompt with ${Object.keys(values).join(', ')}`
    );
  });
  describe('constructor', () => {
    it('defines the aiSettings', () => {
      expect(promptManager['aiSettings']).toEqual(
        expect.objectContaining({
          model: ai.model.externalId,
        })
      );
    });
    it('initializes summary to undefined', () => {
      expect(promptManager['summary']).toBeUndefined();
    });
  });
  describe('getCompliancePrompt', () => {
    it('summarizes policy if summary does not exist', async () => {
      jest.spyOn(promptManager as any, 'summarizePolicy');
      await promptManager.getCompliancePrompt();
      expect(promptManager['summarizePolicy']).toHaveBeenCalled();
    });
    it('gets compliance check prompt', async () => {
      await promptManager.getCompliancePrompt();
      expect(getPromptById).toHaveBeenCalledWith(expect.any(Array), 'compliance-check');
    });
    it('calls insertRequestValuesIntoPrompt with correct values', async () => {
      await promptManager.getCompliancePrompt();
      expect(insertRequestValuesIntoPrompt).toHaveBeenCalledWith(
        {
          content: policy,
          requirements: requirements,
          summary: 'completion',
        },
        mockCompliancePrompt.instructions
      );
    });
    it('adds instructions to query', async () => {
      const query = await promptManager.getCompliancePrompt();
      expect(query).toContain(
        `ADDITIONAL INSTRUCTIONS PROVIDED BY USER:\n\n${instructions}`
      );
    });
    it('does not add instructions if empty', async () => {
      promptManager = new PromptManager(ai, policy, '', requirements);
      const query = await promptManager.getCompliancePrompt();
      expect(query).not.toContain('ADDITIONAL INSTRUCTIONS PROVIDED BY USER');
    });
    it('it passes policy requirements into prompt', async () => {
      await promptManager.getCompliancePrompt();

      expect(insertRequestValuesIntoPrompt).toHaveBeenNthCalledWith(
        2,
        {
          content: policy,
          requirements: requirements,
          summary: 'completion',
        },
        mockCompliancePrompt.instructions
      );
    });
  });
  describe('getConsensusPrompt', () => {
    const input1 = 'This is input 1';
    const input2 = 'This is input 2';
    const input3 = 'This is input 3';
    it('summarizes policy if summary does not exist', async () => {
      jest.spyOn(promptManager as any, 'summarizePolicy');
      await promptManager.getConsensusPrompt(input1, input2, input3);
      expect(promptManager['summarizePolicy']).toHaveBeenCalled();
    });
    it('gets consensus check prompt', async () => {
      await promptManager.getConsensusPrompt(input1, input2, input3);
      expect(getPromptById).toHaveBeenCalledWith(expect.any(Array), 'consensus-check');
    });
    it('calls insertRequestValuesIntoPrompt with correct values', async () => {
      await promptManager.getConsensusPrompt(input1, input2, input3);
      expect(insertRequestValuesIntoPrompt).toHaveBeenCalledWith(
        {
          summary: 'completion',
          input1,
          input2,
          input3,
        },
        mockConsensusPrompt.instructions
      );
    });
    it('adds instructions to query', async () => {
      const query = await promptManager.getConsensusPrompt(
        input1,
        input2,
        input3
      );
      expect(query).toContain(
        `ADDITIONAL INSTRUCTIONS PROVIDED BY USER:\n\n${instructions}`
      );
    });
  });

  describe('error handling', () => {
    it('throws error if failed to summarize policy', async () => {
      const stubError = new Error('AI completion failed');
      const mockError = new Error('Error summarizing policy');

      completion.mockRejectedValueOnce(stubError);

      await expect(
        () => promptManager.getCompliancePrompt()
      ).rejects.toThrow(mockError);

      expect(logger.error).toHaveBeenCalledWith(mockError.message, stubError);
    });
  });
});

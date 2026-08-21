import {
  PromptManager,
  QueryEngine,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';
import { ComplianceChecker } from '@/features/ai-agents/utils/certa/complianceChecker';
import logger from '@/server/logger';
import { parseComplianceResponse } from '@/features/ai-agents/utils/certa/resultParser';

jest.mock('@/features/ai-agents/utils/certa/resultParser');

describe('ComplianceChecker', () => {
  const promptManager: PromptManager = {
    getCompliancePrompt: jest.fn(),
    getConsensusPrompt: jest.fn(),
  };

  const queryEngine: QueryEngine = {
    addDocuments: jest.fn(),
    runQuery: jest.fn(),
  };

  const mockPolicyTitle = 'Policy Title';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('sets promptManager as a class property', () => {
      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      expect(complianceChecker['promptManager']).toBe(promptManager);
    });

    it('sets queryEngine as a class property', () => {
      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      expect(complianceChecker['queryEngine']).toBe(queryEngine);
    });
  });

  describe('checkSinglePolicy', () => {
    const compliancePromptQuery = 'A great compliance prompt';
    promptManager.getCompliancePrompt = jest.fn(async () => {
      return compliancePromptQuery;
    });

    const consensusPromptQuery = 'A great consensus prompt';
    promptManager.getConsensusPrompt = jest.fn(async () => {
      return consensusPromptQuery;
    });

    // The runQuery method is called 4 times
    const nQueries = 4;
    const toString = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();

      queryEngine.runQuery = jest.fn().mockResolvedValue({
        toString,
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('gets the compliance prompt from the prompt manager', async () => {
      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      expect(promptManager.getCompliancePrompt).toHaveBeenCalled();
    });

    it('gets the consensus prompt from the prompt manager', async () => {
      queryEngine.runQuery = jest.fn().mockResolvedValue({
        toString,
      });

      for (let i = 0; i < nQueries; i++) {
        toString.mockReturnValueOnce(`Response ${i}`);
      }

      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      expect(promptManager.getConsensusPrompt).toHaveBeenCalledWith(
        'Response 0',
        'Response 1',
        'Response 2',
      );
    });

    it('executes the compliance query 3 times', async () => {
      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      for (let i = 0; i < nQueries - 1; i++) {
        expect(queryEngine.runQuery).toHaveBeenNthCalledWith(i + 1, compliancePromptQuery);
      }
    });

    it('executes the consensus query once', async () => {
      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      for (let i = nQueries - 1; i < nQueries; i++) {
        expect(queryEngine.runQuery).toHaveBeenNthCalledWith(i + 1, consensusPromptQuery);
      }
    });

    it('logs error if failed to run compliance query', async () => {
      const mockError = new Error('Failed to run compliance query');
      queryEngine.runQuery = jest.fn().mockRejectedValueOnce(mockError);

      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      expect(logger.error).toHaveBeenNthCalledWith(1,
        `There was an error running the complianceQuery: ${mockPolicyTitle}`,
        mockError
      );

      expect(logger.error).toHaveBeenNthCalledWith(2,
        `Error during compliance check for policy: ${mockPolicyTitle}`,
        new Error('There was an error querying the vector store'),
      );
    });

    it('logs error if failed to run consensus query', async () => {
      const mockError = new Error('Failed to run consensus query');
      queryEngine.runQuery = jest.fn(async (query) => {
        if (query === consensusPromptQuery) {
          throw mockError;
        }

        return '';
      });

      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);
      await complianceChecker.checkSinglePolicy(mockPolicyTitle);

      expect(logger.error).toHaveBeenNthCalledWith(1,
        `There was an error running the consensusQuery: ${mockPolicyTitle}`,
        mockError
      );

      expect(logger.error).toHaveBeenNthCalledWith(2,
        `Error during compliance check for policy: ${mockPolicyTitle}`,
        new Error('There was an error querying the vector store'),
      );
    });

    it('returns result and logs completion status', async () => {
      (parseComplianceResponse as jest.Mock).mockReturnValue('Compliance result');

      const complianceChecker = new ComplianceChecker(promptManager, queryEngine);

      await expect(
        complianceChecker.checkSinglePolicy(mockPolicyTitle)
      ).resolves.toEqual({
        isLoading: false,
        result: 'Compliance result',
      });

      expect(logger.debug).toHaveBeenCalledWith(
        `Compliance check completed for policy: ${mockPolicyTitle}`
      );
    });
  });
});

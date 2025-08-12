import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import logger from '@/server/logger';
import generatePolicyRequirements from '@/features/settings/system-ai/ai-agents/certa/generatePolicyRequirements';

jest.mock('@/features/ai-provider');

describe('generatePolicyRequirements', () => {
  const mockBuildSystemSource = jest.fn();
  const mockCompletion = jest.fn();

  const mockAIFactory = {
    buildSystemSource: mockBuildSystemSource,
  } as unknown as AIFactory;

  const mockSystemAi = {
    source: {
      completion: mockCompletion,
    },
    model: {
      externalId: 'default-system-model',
    },
  };

  const mockAiSettings: AiSettings = {
    model: mockSystemAi.model.externalId,
    randomness: 0.6,
    repetitiveness: 0.4,
  };

  const mockPolicyContent =
    'The website must have a privacy policy linked from the footer. The privacy policy must disclose data collection practices.';

  const mockRequirements =
    '- The website must have a privacy policy linked from the footer\n' +
    '- The privacy policy must disclose data collection practices';

  let mockAiResponse = { text: '' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildSystemSource.mockResolvedValue(mockSystemAi);
  });

  it('returns properly formatted requirements from AI response', async () => {
    mockAiResponse.text =
      '- The website must have a privacy policy linked from the footer\n' +
      '- The privacy policy must disclose data collection practices';
    mockCompletion.mockResolvedValueOnce(mockAiResponse);

    const result = await generatePolicyRequirements(
      mockAIFactory,
      mockPolicyContent,
    );

    expect(result).toEqual({ requirements: mockRequirements });
    expect(mockAIFactory.buildSystemSource).toHaveBeenCalledWith();
    expect(mockSystemAi.source.completion).toHaveBeenCalledWith(
      expect.stringContaining(mockPolicyContent),
      mockAiSettings
    );
  });

  it('extracts only lines starting with dashes', async () => {
    mockAiResponse.text =
      'Here are the extracted requirements:\n\n' +
      '- The website must have a privacy policy linked from the footer\n' +
      '- The privacy policy must disclose data collection practices\n\n' +
      'These requirements must be implemented.';
    mockCompletion.mockResolvedValueOnce(mockAiResponse);

    const result = await generatePolicyRequirements(
      mockAIFactory,
      mockPolicyContent,
    );

    expect(result).toEqual({
      requirements: mockRequirements,
    });
  });

  it('handles responses with varied spacing', async () => {
    mockAiResponse.text =
      '-The website must have a privacy policy linked from the footer\n' +
      '- The privacy policy must disclose data collection practices';
    mockCompletion.mockResolvedValueOnce(mockAiResponse);

    const result = await generatePolicyRequirements(
      mockAIFactory,
      mockPolicyContent,
    );

    expect(result).toEqual({
      requirements:
        '-The website must have a privacy policy linked from the footer\n' +
        '- The privacy policy must disclose data collection practices',
    });
  });

  it('returns a default message if no requirements are found', async () => {
    mockAiResponse.text =  'No clear requirements found in the policy document';
    mockCompletion.mockResolvedValueOnce(mockAiResponse);
    const result = await generatePolicyRequirements(
      mockAIFactory,
      mockPolicyContent,
    );
    expect(result).toEqual({
      requirements:
        'No clear requirements found in the policy document',
    });
  }); 

  it('throws an error if buildSystemSource fails', async () => {
    const mockError = new Error('Failed to build system source');
    mockBuildSystemSource.mockRejectedValueOnce(mockError);

    await expect(
      generatePolicyRequirements(mockAIFactory, mockPolicyContent)
    ).rejects.toThrow('Error generating requirements');

    expect(logger.error).toHaveBeenCalledWith(
      'Error generating requirements:',
      mockError
    );
  });

  it('throws an error if completion fails', async () => {
    const mockError = new Error('Failed to get AI response');
    mockCompletion.mockRejectedValueOnce(mockError);

    await expect(
      generatePolicyRequirements(mockAIFactory, mockPolicyContent)
    ).rejects.toThrow('Error generating requirements');

    expect(logger.error).toHaveBeenCalledWith(
      'Error generating requirements:',
      mockError
    );
  });
});

jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockGetChatCompletions = jest.fn();

jest.mock('@azure/openai', () => ({
  OpenAIClient: jest.fn().mockImplementation(() => ({
    getChatCompletions: mockGetChatCompletions,
  })),
  AzureKeyCredential: jest.fn(),
}));

import { AzureOpenAISource } from './azure-openai';

const successResponse = {
  choices: [{ message: { content: 'response text' } }],
  usage: { promptTokens: 10, completionTokens: 20 },
};

describe('AzureOpenAISource', () => {
  let source: AzureOpenAISource;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChatCompletions.mockResolvedValue(successResponse);
    source = new AzureOpenAISource('test-key', 'https://test.openai.azure.com', 'my-deployment');
  });

  it('should instantiate with the provided configuration', () => {
    expect(source).toBeDefined();
  });
});

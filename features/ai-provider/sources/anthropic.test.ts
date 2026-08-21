jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockMessagesCreate = jest.fn();

jest.mock('@anthropic-ai/sdk/shims/node', () => ({}));
jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      messages: { create: mockMessagesCreate },
    })),
    __esModule: true,
  };
});

import { AnthropicSource } from './anthropic';

const successResponse = {
  content: [{ text: 'response text' }],
  usage: { input_tokens: 10, output_tokens: 20 },
};

describe('AnthropicSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMessagesCreate.mockResolvedValue(successResponse);
  });

  it('should instantiate with the provided configuration', () => {
    const source = new AnthropicSource('test-key');
    expect(source).toBeDefined();
  });
});

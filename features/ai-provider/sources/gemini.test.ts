jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

import { GeminiSource } from './gemini';

const successResponse = {
  response: {
    text: () => 'response text',
    usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20 },
  },
};

describe('GeminiSource', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateContent.mockResolvedValue(successResponse);
  });

  it('should instantiate with the provided configuration', () => {
    const source = new GeminiSource('test-key');
    expect(source).toBeDefined();
  });
});

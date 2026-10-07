import type { PrismaClient } from '@prisma/client';

import { MessageRole } from '@/features/chat/types/message';
import logger from '@/server/logger';

import { AuditedSource } from './audit';
import { AiRepository, AiResponse } from './types';

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('AuditedSource', () => {
  let mockSource: jest.Mocked<AiRepository>;
  let mockLogEntryCreate: jest.Mock;
  let mockPrisma: { logEntry: { create: jest.Mock } };
  let auditedSource: AuditedSource;

  const mockResponse: AiResponse = {
    text: 'test response',
    inputTokensUsed: 10,
    outputTokensUsed: 20,
  };

  const userId = 'test-user-id';
  const config = { model: 'test-model', temperature: 0.5, topP: 0.5 };

  beforeEach(() => {
    mockSource = {
      completion: jest.fn().mockResolvedValue(mockResponse),
      chatCompletion: jest.fn().mockResolvedValue(mockResponse),
      createEmbeddings: jest.fn().mockResolvedValue(mockResponse),
    } as jest.Mocked<AiRepository>;

    mockLogEntryCreate = jest.fn().mockResolvedValue({});
    mockPrisma = { logEntry: { create: mockLogEntryCreate } };

    auditedSource = new AuditedSource(
      mockSource,
      userId,
      mockPrisma as unknown as PrismaClient,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('completion', () => {
    it('creates a log entry with correct method and prompt', async () => {
      const prompt = 'summarize this document';

      const result = await auditedSource.completion(prompt, config);

      expect(result).toBe(mockResponse);
      expect(mockLogEntryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'completion',
          prompt,
          result: mockResponse.text,
          userId,
        }),
      });
    });
  });

  describe('chatCompletion', () => {
    it('creates a log entry with JSON-stringified messages', async () => {
      const messages = [
        { role: MessageRole.User, content: 'hello' },
        { role: MessageRole.Assistant, content: 'world' },
      ];

      const result = await auditedSource.chatCompletion(messages, config);

      expect(result).toBe(mockResponse);
      expect(mockLogEntryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'completion',
          prompt: JSON.stringify(messages),
          result: mockResponse.text,
          userId,
        }),
      });
    });
  });

  describe('createEmbeddings', () => {
    it('creates a log entry with comma-joined input strings', async () => {
      const inputs = ['first chunk', 'second chunk', 'third chunk'];

      const result = await auditedSource.createEmbeddings(inputs, config);

      expect(result).toBe(mockResponse);
      expect(mockLogEntryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          method: 'createEmbeddings',
          prompt: inputs.join(', '),
          result: mockResponse.text,
          userId,
        }),
      });
    });
  });

  describe('_run', () => {
    it('stores String(source) in the source field so toString() identifies the provider', async () => {
      const toStringValue = 'AgentProvider(https://test.example.com)';
      (mockSource as unknown as { toString(): string }).toString = jest.fn().mockReturnValue(toStringValue);

      await auditedSource.completion('prompt', config);

      expect(mockLogEntryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: toStringValue,
        }),
      });
    });

    it('passes the context field through to the log entry', async () => {
      const ctx = { requestId: 'req-abc-123' };
      const auditedWithCtx = new AuditedSource(
        mockSource,
        userId,
        mockPrisma as unknown as PrismaClient,
        ctx,
      );

      await auditedWithCtx.completion('prompt', config);

      expect(mockLogEntryCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ context: ctx }),
      });
    });

    it('logs an error and still returns the response when the prisma write fails', async () => {
      mockLogEntryCreate.mockRejectedValue(new Error('DB connection lost'));

      await expect(auditedSource.completion('prompt', config)).resolves.toBe(mockResponse);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(userId),
        expect.any(Error),
      );
    });
  });

  describe('deepResearch', () => {
    it('delegates to the underlying source without creating a log entry', async () => {
      const researchResult = 'deep research findings';
      mockSource.deepResearch = jest.fn().mockResolvedValue(researchResult);

      const result = await auditedSource.deepResearch('input', 'instructions', 10, 'job-id');

      expect(mockSource.deepResearch).toHaveBeenCalledWith('input', 'instructions', 10, 'job-id');
      expect(result).toBe(researchResult);
      expect(mockLogEntryCreate).not.toHaveBeenCalled();
    });

    it('throws when the underlying source does not support deep research', async () => {
      await expect(auditedSource.deepResearch('input', 'instructions')).rejects.toThrow(
        'Deep research is not supported by the underlying source',
      );
    });
  });
});

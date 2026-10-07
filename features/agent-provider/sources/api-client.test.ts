import logger from '@/server/logger';

import { AgentApiClient } from './api-client';

jest.mock('@/server/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('AgentApiClient', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('throws when endpoint is empty', () => {
      expect(() => new AgentApiClient({ endpoint: '' })).toThrow('Agent endpoint is not configured');
    });
  });

  describe('toString', () => {
    it('returns a string identifying the provider endpoint', () => {
      const client = new AgentApiClient({ endpoint: 'https://agent.example.com' });
      expect(client.toString()).toBe('AgentApiClient (https://agent.example.com)');
    });

    it('is used by AuditedSource to populate the source field in log entries', () => {
      // toString() is called via String(this.source) inside AuditedSource._run —
      // confirm the format matches what operators will see in audit logs.
      const client = new AgentApiClient({ endpoint: 'https://prod-agent.internal/api' });
      expect(String(client)).toBe('AgentApiClient (https://prod-agent.internal/api)');
    });
  });

  describe('createEmbeddings', () => {
    it('throws as embeddings are not supported', async () => {
      const client = new AgentApiClient({ endpoint: 'https://agent.example.com' });
      await expect(client.createEmbeddings([], { model: '', temperature: 0, topP: 0 })).rejects.toThrow(
        'Embeddings are not supported by agent providers',
      );
    });
  });

  describe('chatCompletion', () => {
    const endpoint = 'https://agent.example.com';
    const sessionId = 'session-abc';
    const config = { model: '', temperature: 0.2, topP: 0.5, sessionId };

    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('throws when sessionId is missing from config', async () => {
      const client = new AgentApiClient({ endpoint });
      await expect(
        client.chatCompletion([{ role: 'user' as never, content: 'hi' }], { model: '', temperature: 0, topP: 0 }),
      ).rejects.toThrow('External agent request failed');
    });

    it('throws a specific error when the agent session is not found (404)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue(''),
      });

      const client = new AgentApiClient({ endpoint });
      await expect(
        client.chatCompletion([{ role: 'user' as never, content: 'hi' }], config),
      ).rejects.toThrow('AGENT_SESSION_NOT_FOUND');
    });

    it('returns the last assistant messages after the most recent user message', async () => {
      const { MessageRole } = await import('@/features/chat/types/message');

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({
          messages: [
            { role: MessageRole.User, content: 'hello' },
            { role: MessageRole.Assistant, content: 'first reply' },
            { role: MessageRole.Assistant, content: 'second reply' },
          ],
        }),
      });

      const client = new AgentApiClient({ endpoint });
      const result = await client.chatCompletion(
        [{ role: MessageRole.User, content: 'hello' }],
        config,
      );

      expect(result.text).toBe('first reply\n\nsecond reply');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('[AgentApiClient]'),
      );
    });
  });
});

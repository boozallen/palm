import logger from '@/server/logger';
import { AiSettings } from '@/types';
import { MessageRole } from '@/features/chat/types/message';
import { AiRepository, AiResponse, ChatCompletionMessage } from '@/features/ai-provider/sources/types';

export interface AgentApiClientConfig {
  endpoint: string;
  apiKey?: string;
}

export class AgentApiClient implements AiRepository {
  private readonly endpoint: string;
  private readonly apiKey: string | undefined;

  constructor(config: AgentApiClientConfig) {
    if (!config.endpoint) {
      throw new Error('Agent endpoint is not configured');
    }
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
  }

  async chatCompletion(
    chatMessages: ChatCompletionMessage[],
    config: AiSettings,
  ): Promise<AiResponse> {
    try {
      if (!config.sessionId) {
        throw new Error('sessionId is required for AgentApiClient');
      }

      const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === MessageRole.User)?.content ?? '';
      const url = `${this.endpoint}/sessions/${config.sessionId}/respond`;

      logger.info('[AgentApiClient] Request sent');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify({ response: lastUserMessage }),
      });

      logger.info('[AgentApiClient] Response received: ' + response.status);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error body');
        logger.error('[AgentApiClient] Error response', { status: response.status, statusText: response.statusText, body: errorBody });
        if (response.status === 404) {
          throw new Error('AGENT_SESSION_NOT_FOUND');
        }
        throw new Error(`Agent endpoint returned ${response.status}: ${response.statusText}`);
      }

      type AgentResponse = {
        status?: string;
        messages?: { role: MessageRole; content: string }[];
        artifacts?: Record<string, string>;
        user_choices?: Record<string, string>;
      };

      const data = await response.json() as AgentResponse;

      const allMessages = data.messages ?? [];
      const lastUserIndex = allMessages.reduce((acc, m, i) => m.role === MessageRole.User ? i : acc, -1);
      const assistantMessages = allMessages
        .slice(lastUserIndex + 1)
        .filter((m) => m.role === MessageRole.Assistant);

      const text = assistantMessages
        .map((m) => m.content)
        .join('\n\n');

      return {
        text,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        messages: assistantMessages,
        artifacts: data.status === 'complete' ? data.artifacts : undefined,
        userChoices: data.status === 'complete' ? data.user_choices : undefined,
      };
    } catch (error) {
      if (error instanceof Error && error.message === 'AGENT_SESSION_NOT_FOUND') {
        throw error;
      }
      logger.error('AgentApiClient.chatCompletion failed', error);
      throw new Error('External agent request failed');
    }
  }

  async completion(prompt: string, config: AiSettings): Promise<AiResponse> {
    return this.chatCompletion([{ role: MessageRole.User, content: prompt }], config);
  }

  async createEmbeddings(_input: string[], _config: AiSettings): Promise<AiResponse> {
    throw new Error('Embeddings are not supported by agent providers');
  }

  toString() {
    return `AgentApiClient (${this.endpoint})`;
  }
}

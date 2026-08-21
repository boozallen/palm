import { randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

import logger from '@/server/logger';
import { AIFactory } from '@/features/ai-provider/factory';
import { MessageRole } from '@/features/chat/types/message';
import { ChatCompletionMessage, ToolAwareMessage, ToolDefinition } from '@/features/ai-provider/sources/types';
import db from '@/server/db';
import {
  isTrackableUserId,
  parseUsageAttributionHeaders,
} from '@/features/ai-provider/utils/usageAttribution';

type AnthropicTextBlock = { type: 'text'; text: string };
type AnthropicToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
type AnthropicToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string | AnthropicTextBlock[] };
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock;

type AnthropicMessage = {
  role: string;
  content: string | AnthropicContentBlock[];
};

type AnthropicTool = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

// Gemini thought_signature cache: maps toolCallId → rawGeminiContent for in-flight turns.
// Entries expire after 10 minutes to avoid unbounded growth.
const _geminiRawCache = new Map<string, { content: unknown; expiresAt: number }>();
const _CACHE_TTL_MS = 10 * 60 * 1000;

function _cacheGeminiContent(toolCallId: string, rawGeminiContent: unknown): void {
  _geminiRawCache.set(toolCallId, { content: rawGeminiContent, expiresAt: Date.now() + _CACHE_TTL_MS });
  // Evict expired entries
  const now = Date.now();
  for (const [key, entry] of _geminiRawCache) {
    if (entry.expiresAt < now) {
      _geminiRawCache.delete(key);
    }
  }
}

function _getGeminiContent(toolCallId: string): unknown | undefined {
  const entry = _geminiRawCache.get(toolCallId);
  if (!entry) { return undefined; }
  if (entry.expiresAt < Date.now()) {
    _geminiRawCache.delete(toolCallId);
    return undefined;
  }
  return entry.content;
}

function writeEvent(res: NextApiResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toToolAwareMessage(msg: AnthropicMessage): ToolAwareMessage | null {
  if (typeof msg.content === 'string') {
    if (msg.role === 'system') {
      return { role: 'system', content: msg.content };
    }
    return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content };
  }

  const blocks = msg.content;

  const toolUseBlock = blocks.find((b): b is AnthropicToolUseBlock => b.type === 'tool_use');
  if (toolUseBlock) {
    const rawGeminiContent = _getGeminiContent(toolUseBlock.id);
    return {
      role: 'tool_call',
      toolCallId: toolUseBlock.id,
      toolName: toolUseBlock.name,
      toolInput: toolUseBlock.input,
      ...(rawGeminiContent !== undefined ? { rawGeminiContent } : {}),
    };
  }

  const toolResultBlock = blocks.find((b): b is AnthropicToolResultBlock => b.type === 'tool_result');
  if (toolResultBlock) {
    const content = typeof toolResultBlock.content === 'string'
      ? toolResultBlock.content
      : toolResultBlock.content.map((b) => b.text).join('');
    return { role: 'tool', toolCallId: toolResultBlock.tool_use_id, content };
  }

  const text = blocks
    .filter((b): b is AnthropicTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  if (msg.role === 'system') {
    return { role: 'system', content: text };
  }
  return { role: msg.role === 'assistant' ? 'assistant' : 'user', content: text };
}

function hasToolBlocks(messages: AnthropicMessage[]): boolean {
  return messages.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => b.type === 'tool_use' || b.type === 'tool_result'),
  );
}

const handler = async (req: NextApiRequest, res: NextApiResponse): Promise<void> => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!internalApiKey) {
    logger.error('[INTERNAL/V1/MESSAGES] INTERNAL_API_KEY is not configured');
    res.status(500).json({ error: { message: 'Server misconfiguration', type: 'server_error' } });
    return;
  }

  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'];
  const isAuthorized = authHeader === `Bearer ${internalApiKey}` || apiKeyHeader === internalApiKey;
  if (!isAuthorized) {
    res.status(401).json({ error: { message: 'Unauthorized', type: 'auth_error' } });
    return;
  }

  const { model, messages, system: rawSystem, stream, tools, max_tokens: rawMaxTokens } = req.body as {
    model: string;
    messages: AnthropicMessage[];
    system?: string | AnthropicContentBlock[];
    stream?: boolean;
    tools?: AnthropicTool[];
    max_tokens?: number;
  };
  const modelMaxOutput = model?.includes('opus') ? 128000 : 64000;
  const maxTokens = Math.max(rawMaxTokens || 0, modelMaxOutput);

  logger.info(`[INTERNAL/V1/MESSAGES] model=${model} max_tokens_received=${rawMaxTokens ?? 'none'} max_tokens_used=${maxTokens} tools=${tools?.length ?? 0} msgs=${messages?.length ?? 0}`);

  const system: string | undefined = typeof rawSystem === 'string'
    ? rawSystem
    : Array.isArray(rawSystem)
      ? rawSystem.filter((b): b is AnthropicTextBlock => b.type === 'text').map((b) => b.text).join('')
      : undefined;

  if (!model || !Array.isArray(messages) || messages.length === 0) {
    logger.warn('[INTERNAL/V1/MESSAGES] 400 bad request', { model, msgCount: Array.isArray(messages) ? messages.length : typeof messages, query: req.query });
    res.status(400).json({ error: { message: 'Missing required fields: model, messages', type: 'invalid_request_error' } });
    return;
  }

  try {
    // This endpoint only serves completions, so an embedding model is not a
    // valid target even when named explicitly.
    const modelRecord = await db.model.findFirst({
      where: { externalId: model, deletedAt: null, embeddingsOnly: false },
      select: { id: true, externalId: true },
    });

    if (!modelRecord) {
      // A caller cannot tell a missing model from a soft-deleted or
      // embeddings-only one, so name the reason here rather than leaving the
      // 400 to be diagnosed by querying the Model table by hand.
      logger.warn('[INTERNAL/V1/MESSAGES] 400 model not found, deleted, or embeddings-only', { model });
      res.status(400).json({ error: { message: `Model not found: ${model}`, type: 'invalid_request_error' } });
      return;
    }

    const rawUserId = req.headers['x-user-id'] as string | undefined;
    const trackable = isTrackableUserId(rawUserId);
    const factory = new AIFactory({ userId: rawUserId || 'system' });

    // AiProviderUsage.userId is a uuid with a foreign key to User, and the usage
    // tracker rethrows when its insert fails, so a call that cannot name a real
    // user stays untracked instead of failing the caller outright. No caller
    // sends the header yet, so an absent one is the expected state and stays
    // silent; a header that is present but malformed is a misconfiguration.
    if (rawUserId && !trackable) {
      logger.warn('[INTERNAL/V1/MESSAGES] Usage not tracked: x-user-id is not a user id', {
        model: modelRecord.externalId,
      });
    }

    // Agent SDK spend is billed like any other user call. agent: true buckets it
    // as agent usage in analytics and keeps it out of the plain chat figures.
    const ai = trackable
      ? await factory.buildUserSource(modelRecord.id, {
        agent: true,
        auditContext: { referer: '/api/internal/v1/messages' },
        attribution: parseUsageAttributionHeaders(req.headers),
      })
      : await factory.buildSource(modelRecord.id);

    const useTools = (tools && tools.length > 0) || hasToolBlocks(messages);

    if (useTools) {
      if (!ai.source.chatCompletionWithTools) {
        res.status(422).json({ error: { message: 'Model provider does not support tool use', type: 'invalid_request_error' } });
        return;
      }

      const toolDefs: ToolDefinition[] = (tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.input_schema,
      }));

      const toolMessages: ToolAwareMessage[] = [];

      if (system) {
        toolMessages.push({ role: 'system', content: system });
      }

      for (const m of messages) {
        const converted = toToolAwareMessage(m);
        if (converted) {
          toolMessages.push(converted);
        }
      }

      const toolResponse = await ai.source.chatCompletionWithTools(toolMessages, toolDefs, {
        model: ai.model.externalId,
        temperature: 0.2,
        topP: 0.9,
        ...(maxTokens ? { maxTokens } : {}),
      });

      // Use a unique ID per tool call so the thought_signature cache key is stable
      // even when the same tool (e.g. "Bash") is called multiple times in a session.
      const uniqueToolCallId = toolResponse.type === 'tool_call' ? `toolu_${randomUUID()}` : '';
      if (toolResponse.type === 'tool_call' && toolResponse.rawGeminiContent !== undefined) {
        _cacheGeminiContent(uniqueToolCallId, toolResponse.rawGeminiContent);
      }

      const msgId = `msg_${Date.now()}`;
      const stopReason = toolResponse.type === 'tool_call' ? 'tool_use' : 'end_turn';
      const contentBlocks: AnthropicContentBlock[] = toolResponse.type === 'tool_call'
        ? [{ type: 'tool_use', id: uniqueToolCallId, name: toolResponse.toolName, input: toolResponse.toolInput }]
        : [{ type: 'text', text: toolResponse.text }];

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.flushHeaders();

        writeEvent(res, 'message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            content: [],
            model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: toolResponse.inputTokensUsed, output_tokens: 0 },
          },
        });

        if (toolResponse.type === 'tool_call') {
          writeEvent(res, 'content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'tool_use', id: uniqueToolCallId, name: toolResponse.toolName, input: {} },
          });
          writeEvent(res, 'ping', { type: 'ping' });
          writeEvent(res, 'content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: JSON.stringify(toolResponse.toolInput) },
          });
        } else {
          writeEvent(res, 'content_block_start', {
            type: 'content_block_start',
            index: 0,
            content_block: { type: 'text', text: '' },
          });
          writeEvent(res, 'ping', { type: 'ping' });
          writeEvent(res, 'content_block_delta', {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text: toolResponse.text },
          });
        }

        writeEvent(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });
        writeEvent(res, 'message_delta', {
          type: 'message_delta',
          delta: { stop_reason: stopReason, stop_sequence: null },
          usage: { output_tokens: toolResponse.outputTokensUsed },
        });
        writeEvent(res, 'message_stop', { type: 'message_stop' });
        res.end();
        return;
      }

      res.status(200).json({
        id: msgId,
        type: 'message',
        role: 'assistant',
        content: contentBlocks,
        model,
        stop_reason: stopReason,
        usage: { input_tokens: toolResponse.inputTokensUsed, output_tokens: toolResponse.outputTokensUsed },
      });
      return;
    }

    const chatMessages: ChatCompletionMessage[] = [];
    if (system) {
      chatMessages.push({ role: MessageRole.System, content: system });
    }
    for (const m of messages) {
      const role = m.role === 'assistant' ? MessageRole.Assistant : MessageRole.User;
      const content = typeof m.content === 'string'
        ? m.content
        : m.content.filter((b): b is AnthropicTextBlock => b.type === 'text').map((b) => b.text).join('');
      chatMessages.push({ role, content });
    }

    const response = await ai.source.chatCompletion(chatMessages, {
      model: ai.model.externalId,
      temperature: 0.2,
      topP: 0.9,
      ...(maxTokens ? { maxTokens } : {}),
    });

    if (stream) {
      const msgId = `msg_${Date.now()}`;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.flushHeaders();

      writeEvent(res, 'message_start', {
        type: 'message_start',
        message: {
          id: msgId,
          type: 'message',
          role: 'assistant',
          content: [],
          model,
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: response.inputTokensUsed, output_tokens: 0 },
        },
      });

      writeEvent(res, 'content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      });

      writeEvent(res, 'ping', { type: 'ping' });

      writeEvent(res, 'content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: response.text },
      });

      writeEvent(res, 'content_block_stop', { type: 'content_block_stop', index: 0 });

      writeEvent(res, 'message_delta', {
        type: 'message_delta',
        delta: { stop_reason: 'end_turn', stop_sequence: null },
        usage: { output_tokens: response.outputTokensUsed },
      });

      writeEvent(res, 'message_stop', { type: 'message_stop' });

      res.end();
      return;
    }

    res.status(200).json({
      id: `msg_${Date.now()}`,
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: response.text }],
      model,
      stop_reason: 'end_turn',
      usage: { input_tokens: response.inputTokensUsed, output_tokens: response.outputTokensUsed },
    });
  } catch (error) {
    logger.error('[INTERNAL/V1/MESSAGES] Failed', { model, error: (error as Error).message, stack: (error as Error).stack });
    if (stream) {
      res.end();
    } else {
      res.status(500).json({ error: { message: (error as Error).message, type: 'server_error' } });
    }
  }
};

export default handler;

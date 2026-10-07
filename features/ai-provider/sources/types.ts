import { MessageRole } from '@/features/chat/types/message';
import { AiSettings } from '@/types';

export const completionResponseError = 'Did not receive a completion response from the AI';
export const emptyCompletionResponseError = 'Content is empty in the AI response';
export const totalTokenUsageResponseError = 'Did not received total token usage in response';
export const embeddingsResponseError = 'The AI was unable to generate embeddings for the given input';

export interface EmbeddingResponse {
  embedding: number[]
}

export interface AiResponse {
  text: string,
  inputTokensUsed: number,
  outputTokensUsed: number,
  embeddings?: EmbeddingResponse[],
  messages?: Array<{ role: MessageRole; content: string }>,
  artifacts?: Record<string, string>,
  userChoices?: Record<string, string>,
}
export interface ChatCompletionMessage {
  role: MessageRole;
  content: string;
}

// Internal types for providers that need job tracking
export interface DeepResearchJobData {
  jobId: string;
  userId: string;
  modelId: string;
  chatId?: string;
  input: string;
  instructions?: string;
  maxToolCalls?: number;
  provider: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ToolAwareMessage =
  | { role: 'user' | 'assistant' | 'system'; content: string }
  | { role: 'tool_call'; toolCallId: string; toolName: string; toolInput: Record<string, unknown>; rawGeminiContent?: unknown }
  | { role: 'tool'; toolCallId: string; content: string }

export type ToolCallEntry = { toolCallId: string; toolName: string; toolInput: Record<string, unknown> };

export type ToolAwareResponse =
  | { type: 'text'; text: string; inputTokensUsed: number; outputTokensUsed: number }
  | { type: 'tool_call'; toolCallId: string; toolName: string; toolInput: Record<string, unknown>; inputTokensUsed: number; outputTokensUsed: number; rawGeminiContent?: unknown }
  | { type: 'tool_calls'; toolCalls: ToolCallEntry[]; text?: string; inputTokensUsed: number; outputTokensUsed: number }

export type StreamEvent =
  | { type: 'thinking_delta'; text: string }
  | { type: 'text_delta'; text: string }
  | { type: 'tool_start'; toolUseId: string; toolName: string }
  | { type: 'tool_delta'; input: string }
  | { type: 'done'; response: ToolAwareResponse }

export type AiRepository = {
  completion(prompt: string, config: AiSettings): Promise<AiResponse>,
  chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings): Promise<AiResponse>,
  createEmbeddings(input: string[], config: AiSettings): Promise<AiResponse>,
  deepResearch?(input: string, instructions: string, maxToolCalls?: number, cancellationJobId?: string): Promise<string>,
  chatCompletionWithTools?(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): Promise<ToolAwareResponse>,
  streamChatCompletionWithTools?(messages: ToolAwareMessage[], tools: ToolDefinition[], config: AiSettings, forceToolUse?: boolean): AsyncGenerator<StreamEvent>,
}

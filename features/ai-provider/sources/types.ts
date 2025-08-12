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
}
export interface ChatCompletionMessage {
  role: MessageRole;
  content: string;
}

export type AiRepository = {
  completion(prompt: string, config: AiSettings): Promise<AiResponse>,
  chatCompletion(chatMessages: ChatCompletionMessage[], config: AiSettings): Promise<AiResponse>,
  createEmbeddings(input: string[], config: AiSettings): Promise<AiResponse>
}

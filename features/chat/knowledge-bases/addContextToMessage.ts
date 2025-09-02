import { Citation } from '@/features/chat/types/message';

export default function addContextToMessage(message: string, citations: Citation[]): string {

  if (!citations.length) {
    return message;
  }

  const context = `[\n${
    citations.map((ctx) => `{\nContent: ${ctx.citation}\nCitation: ${ctx.sourceLabel}\n}`).join('\n')
  }\n]`;

  const updatedMessage = `
  ## User message:
  ${message}

  ## Additional Contextual Information:
  ${context}

  ## Rules:
  1. Only when the user's message references provided context, integrate that context into the response.
  2. Supplement the context with additional information from the LLM to provide a detailed and comprehensive response.
  3. Do not use citations in the response.
  `;

  return updatedMessage;
}

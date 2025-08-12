import { AIFactory } from '@/features/ai-provider';
import logger from '@/server/logger';

export function summarizePrompt(userMsg: string, aiMsg: string): string {
  return `Summarize this chat conversation into a concise title, 35 characters or less, in title case, and no quotes.

User message:
"""
${userMsg}
"""

Assistant message:
"""
${aiMsg}
"""`;
}

export default async function generateChatConversationSummary(
  ai: AIFactory,
  messages: {
    role: string,
    content: string,
    messagedAt: string,
  }[],
): Promise<{ summary: string | null }> {

  const userMessage = messages.find(message => message.role === 'user');
  const assistantMessage = messages.find(message => message.role === 'assistant');

  const prompt = summarizePrompt(
    userMessage?.content ?? '',
    assistantMessage?.content ?? '',
  );

  try {
    const aiSource = await ai.buildSystemSource();

    const summaryResponse = await aiSource.source.completion(prompt, {
      model: aiSource.model.externalId,
      randomness: 0.2,
      repetitiveness: 0.5,
    });
    const summary = summaryResponse.text.trim() || null;
    return { summary };
  } catch (error) {
    logger.error('Error generating chat conversation summary:', error);
    return { summary: null };
  }
}

import { AIFactory } from '@/features/ai-provider';
import logger from '@/server/logger';
import { UseCase, USE_CASE_PROMPT_LABELS } from '@/features/shared/types/use-case';

const PROMPTABLE_USE_CASE_LABELS = Object.values(USE_CASE_PROMPT_LABELS);

// Disambiguates cases where the use case name alone is ambiguous.
const USE_CASE_BOUNDARY_RULES = `Use these rules to pick the use case:
- Staffing for a bid is Proposal Capture. Staffing in general is Program Delivery.
- A security policy, control or assessment is Policy Compliance. A security exploit, scan or tooling task is Engineering.
- SQL written to answer a question is Data Analytics. SQL written as part of a schema or application change is Engineering.
- Explaining a concept to the user is Research Analysis, not Writing Communication. Writing Communication requires an artifact intended for someone else.
- Anything whose evident purpose is exercising the tool rather than doing work is Trial Test, regardless of subject matter. A poem about compliance is Trial Test, not Policy Compliance.
- Purpose beats activity. Work whose evident purpose is a bid, a proposal, an RFI or RFP response, or orals is Proposal Capture even when the activity itself is research, analysis, writing or engineering.`;

// Titles an unanswered chat, and deliberately asks for no use case. A title names
// the request, so the request alone is enough; a category is a judgment about what
// the conversation turned out to be for, which assignChatUseCase makes once a reply
// exists. Separate from summarizePrompt rather than passing it an empty assistant
// block, because an empty block reads to the model as nothing having happened and
// lands the chat on Trial Test whatever was asked.
export function titlePrompt(userMsg: string): string {
  return `Title this chat conversation. Return a valid JSON object with this exact structure:
{
  "summary": string
}

Rules:
- "summary": a concise title, 35 characters or less, in title case, no quotes.
- Title the message on its own terms. Do not remark on the absence of a reply.

Return ONLY the JSON object — no markdown fences, no backticks, no additional text.

User message:
"""
${userMsg}
"""`;
}

// Asks for a category and nothing else, for the answered chat that already has a
// title. assignChatUseCase reads only useCase, so pointing it at summarizePrompt
// would pay output tokens for a title with nowhere to go — and invite the model to
// spend its attention naming the conversation rather than placing it.
export function classifyUseCasePrompt(userMsg: string, aiMsg: string): string {
  return `Identify the use case of this chat conversation. Return a valid JSON object with this exact structure:
{
  "useCase": string
}

Rules:
- "useCase": exactly one of: ${PROMPTABLE_USE_CASE_LABELS.join(', ')}.

${USE_CASE_BOUNDARY_RULES}

Return ONLY the JSON object — no markdown fences, no backticks, no additional text.

User message:
"""
${userMsg}
"""

Assistant message:
"""
${aiMsg}
"""`;
}

export function summarizePrompt(userMsg: string, aiMsg: string): string {
  return `Summarize this chat conversation and identify its use case. Return a valid JSON object with this exact structure:
{
  "summary": string,
  "useCase": string
}

Rules:
- "summary": a concise title, 35 characters or less, in title case, no quotes.
- "useCase": exactly one of: ${PROMPTABLE_USE_CASE_LABELS.join(', ')}.

${USE_CASE_BOUNDARY_RULES}

Return ONLY the JSON object — no markdown fences, no backticks, no additional text.

User message:
"""
${userMsg}
"""

Assistant message:
"""
${aiMsg}
"""`;
}

type Result = {
  summary: string | null,
  useCase: UseCase | null,
};

function parseResponse(text: string): Result {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return { summary: null, useCase: null };
  }

  try {
    const parsed = JSON.parse(match[0]);
    return { summary: parsed.summary ?? null, useCase: parsed.useCase ?? null };
  } catch {
    return { summary: null, useCase: null };
  }
}

// The one place a prompt from this module reaches a model. Shared so the settings
// that make a classification reproducible — the low temperature and topP above all
// — cannot drift between the two callers.
async function complete(ai: AIFactory, prompt: string): Promise<Result> {
  const aiSource = await ai.buildSystemSource();

  const summaryResponse = await aiSource.source.completion(prompt, {
    model: aiSource.model.externalId,
    temperature: 0.2,
    topP: 0.5,
  });

  return parseResponse(summaryResponse.text);
}

// Categorizes an answered chat and returns nothing else. Throws rather than
// swallowing: the only caller is assignChatUseCase, which logs with the chat id
// attached and is already the place that decides a failed classification is
// survivable.
export async function classifyChatUseCase(
  ai: AIFactory,
  userMessage: string,
  assistantMessage: string,
): Promise<UseCase | null> {
  const { useCase } = await complete(ai, classifyUseCasePrompt(userMessage, assistantMessage));

  return useCase;
}

export default async function generateChatConversationSummary(
  ai: AIFactory,
  messages: {
    role: string,
    content: string,
    messagedAt: string,
  }[],
): Promise<Result> {

  const userMessage = messages.find(message => message.role === 'user');
  const assistantMessage = messages.find(message => message.role === 'assistant');

  // Blank, not absent: add-message writes the assistant row with empty content and
  // the worker fills it in later, so a caller titling a new chat holds a message
  // that has nothing in it yet.
  const answered = (assistantMessage?.content ?? '').trim() !== '';

  const prompt = answered
    ? summarizePrompt(userMessage?.content ?? '', assistantMessage?.content ?? '')
    : titlePrompt(userMessage?.content ?? '');

  try {
    const parsed = await complete(ai, prompt);

    // titlePrompt never asked for a use case, so one in the response was volunteered
    // — which is the guess this change exists to stop. Discarded, not trusted.
    return answered ? parsed : { summary: parsed.summary, useCase: null };
  } catch (error) {
    logger.error('Error generating chat conversation summary:', error);
    return { summary: null, useCase: null };
  }
}

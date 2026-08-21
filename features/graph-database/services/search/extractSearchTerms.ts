import { AiRepository } from '@/features/ai-provider/sources/types';
import { MessageRole } from '@/features/chat/types/message';
import { logger } from '@/server/logger';

export interface ExtractedSearchTerms {
  terms: string[];
}

const EXTRACTION_PROMPT = (query: string) =>
  `Extract all named entities, proper nouns, concepts, acronyms, and key technical terms from the following query for use in a knowledge graph search.
Return JSON only, no other text: { "terms": ["term1", "term2"] }
Omit stopwords, question words, conjunctions, and generic verbs.

Query: ${query}`;

export async function extractSearchTerms(
  query: string,
  source: AiRepository,
  model: { externalId: string }
): Promise<ExtractedSearchTerms> {
  try {
    const response = await source.chatCompletion(
      [{ role: MessageRole.User, content: EXTRACTION_PROMPT(query) }],
      { model: model.externalId, temperature: 0, topP: 0 }
    );
    let cleaned = response.text
      .replace(/```(?:json)?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[HYBRID-SEARCH] extractSearchTerms: no JSON found in response', { raw: response.text.substring(0, 200) });
      return { terms: [] };
    }
    const parsed = JSON.parse(jsonMatch[0]);
    const terms = Array.isArray(parsed?.terms)
      ? parsed.terms.filter((t: unknown) => typeof t === 'string' && t.trim())
      : [];
    if (terms.length === 0) {
      logger.warn('[HYBRID-SEARCH] extractSearchTerms returned empty terms');
    }
    return { terms };
  } catch (error) {
    logger.warn('[HYBRID-SEARCH] extractSearchTerms failed, returning empty terms', { error });
    return { terms: [] };
  }
}

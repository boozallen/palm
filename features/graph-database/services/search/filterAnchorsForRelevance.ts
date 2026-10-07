import { AiRepository } from '@/features/ai-provider/sources/types';
import { EntitySearchResult } from '@/features/chat/dal/getEntitiesForQuery';
import { ConceptSearchResult } from '@/features/chat/dal/getConceptsForQuery';
import { Citation, MessageRole } from '@/features/chat/types/message';
import { logger } from '@/server/logger';

const FILTER_PROMPT = (query: string, items: string) =>
  `Given the user query below, identify items that are IRRELEVANT to answering the question. Keep everything that could be useful — only remove items that are clearly noise or unrelated.

Return JSON only, no other text:
{ "irrelevant": [{ "index": 3, "reason": "brief reason" }, { "index": 7, "reason": "brief reason" }] }

If ALL items are relevant, return: { "irrelevant": [] }

The index numbers are zero-based indices into the list below.

Query: ${query}

Items:
${items}`;

export interface FilteredAnchors {
  entities: EntitySearchResult[];
  concepts: ConceptSearchResult[];
  chunks: Citation[];
}

/**
 * Filter entities, concepts, and chunks for relevance to the user query via a single LLM call.
 * Asks the LLM to identify IRRELEVANT items (with reasons) rather than relevant ones,
 * which produces more conservative filtering and better debuggability.
 * Gracefully falls back to returning all items if the LLM call fails.
 */
export async function filterAnchorsForRelevance(
  query: string,
  entities: EntitySearchResult[],
  concepts: ConceptSearchResult[],
  source: AiRepository,
  model: { externalId: string },
  chunks: Citation[] = [],
): Promise<FilteredAnchors> {
  const totalItems = entities.length + concepts.length + chunks.length;
  if (totalItems <= 1) {
    return { entities, concepts, chunks };
  }

  const conceptOffset = entities.length;
  const chunkOffset = conceptOffset + concepts.length;

  // Helper to get item name by index for logging
  const getItemName = (idx: number): string => {
    if (idx < conceptOffset) {return `[Entity] ${entities[idx].entityName}`;}
    if (idx < chunkOffset) {return `[Concept] ${concepts[idx - conceptOffset].conceptName}`;}
    return `[Chunk] ${chunks[idx - chunkOffset].sourceLabel}`;
  };

  try {
    // Build combined list: entities first, then concepts, then chunks
    const entityLines = entities.map(
      (e, i) => `${i}. [Entity] ${e.entityName}${e.description ? ` — ${e.description}` : ''}`,
    );
    const conceptLines = concepts.map(
      (c, i) => `${conceptOffset + i}. [Concept] ${c.conceptName}${c.description ? ` — ${c.description}` : ''}`,
    );
    const chunkLines = chunks.map(
      (ch, i) => `${chunkOffset + i}. [Chunk] ${ch.sourceLabel}: "${ch.citation.substring(0, 200)}"`,
    );
    const itemList = [...entityLines, ...conceptLines, ...chunkLines].join('\n');

    const response = await source.chatCompletion(
      [{ role: MessageRole.User, content: FILTER_PROMPT(query, itemList) }],
      { model: model.externalId, temperature: 0, topP: 0 },
    );

    let cleaned = response.text
      .replace(/```(?:json)?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();
    cleaned = cleaned.replace(/,\s*([\]}])/g, '$1');

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[EXPLANATION] filterAnchorsForRelevance: no JSON found', {
        raw: response.text.substring(0, 200),
      });
      return { entities, concepts, chunks };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const irrelevantItems = Array.isArray(parsed?.irrelevant) ? parsed.irrelevant : [];

    // Extract valid indices from the irrelevant list
    const irrelevantIndices = new Set(
      irrelevantItems
        .filter((item: any) => typeof item?.index === 'number' && item.index >= 0 && item.index < totalItems)
        .map((item: any) => item.index as number)
    );

    // Log each dropped item with its reason
    if (irrelevantIndices.size > 0) {
      const droppedItems = irrelevantItems
        .filter((item: any) => typeof item?.index === 'number' && item.index >= 0 && item.index < totalItems)
        .map((item: any) => ({
          item: getItemName(item.index),
          reason: item.reason || 'no reason given',
        }));
      logger.info('[EXPLANATION] Anchor filter dropped items', { query, droppedItems });
    }

    // Keep everything that wasn't marked irrelevant
    const filteredEntities = entities.filter((_, i) => !irrelevantIndices.has(i));
    const filteredConcepts = concepts.filter((_, i) => !irrelevantIndices.has(conceptOffset + i));
    const filteredChunks = chunks.filter((_, i) => !irrelevantIndices.has(chunkOffset + i));

    // Never reduce any list to zero if the original had items
    return {
      entities: filteredEntities.length > 0 || entities.length === 0 ? filteredEntities : entities,
      concepts: filteredConcepts.length > 0 || concepts.length === 0 ? filteredConcepts : concepts,
      chunks: filteredChunks.length > 0 || chunks.length === 0 ? filteredChunks : chunks,
    };
  } catch (error) {
    logger.warn('[EXPLANATION] filterAnchorsForRelevance failed, keeping all', { error });
    return { entities, concepts, chunks };
  }
}

import { AIFactory } from '@/features/ai-provider/factory';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import { getScopedGraphSchema } from '@/features/graph-database/dal/getGraphSchema';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import { MessageRole } from '@/features/chat/types/message';
import { logger } from '@/server/logger';

/**
 * Query type classification for the router
 */
export type QueryType = 'enumeration' | 'aggregation' | 'explanation';

/**
 * Confidence scores for each query type (multi-label classification)
 */
export interface MultiConfidence {
  enumeration: number;
  aggregation: number;
  explanation: number;
}

/**
 * Result from query classification with multi-confidence scores.
 * Multiple types can pass threshold, enabling hybrid responses.
 */
export interface ClassificationResult {
  /** All confidence scores for each type */
  confidences: MultiConfidence;
  /** Types that passed the confidence threshold */
  activeTypes: QueryType[];
  /** Primary type (highest confidence that passed threshold, or explanation as fallback) */
  primaryType: QueryType;
}

/**
 * Confidence threshold for classification.
 * Types with confidence >= threshold will be included in activeTypes.
 */
const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Classify a user query to determine the appropriate handler(s).
 *
 * Uses an LLM to classify queries with confidence scores for each type:
 * - enumeration: List of items (list all, show every, what entities)
 * - aggregation: Computed summaries (count, how many, statistics)
 * - explanation: Understanding/context (what is, explain, describe)
 *
 * Returns multi-confidence scores allowing hybrid queries (e.g., "what do these
 * documents have in common?" may have high confidence for both enumeration and
 * explanation, triggering both paths).
 *
 * Falls back to explanation-only when:
 * - No AI provider configured
 * - All confidences below threshold
 * - LLM call fails
 *
 * @param query - User's question about the knowledge graph
 * @param userId - User ID for AI factory
 * @returns ClassificationResult with multi-confidence scores and active types
 */
export async function classifyQuery(
  query: string,
  userId: string,
  documentIds: string[] = [],
  accessibleDocIds?: AccessibleDocIds,
  userGroupId?: string,
): Promise<ClassificationResult> {
  const defaultResult: ClassificationResult = {
    confidences: { enumeration: 0, aggregation: 0, explanation: 1 },
    activeTypes: ['explanation'],
    primaryType: 'explanation',
  };

  const systemConfig = await getSystemConfig();

  if (!systemConfig.knowledgeGraphAiProviderModelId) {
    logger.warn('[QUERY-ROUTER] No knowledge graph AI provider configured, defaulting to explanation');
    return defaultResult;
  }

  try {
    const factory = new AIFactory({ userId, userGroupId });
    const { source, model } = await factory.buildKnowledgeGraphSource();

    // Fetch schema scoped to accessible documents for accurate classification
    const effectiveAccessibleDocIds = accessibleDocIds ?? await getAccessibleDocumentIds(userId);
    const schema = await getScopedGraphSchema(effectiveAccessibleDocIds, documentIds);
    const prompt = buildClassificationPrompt(query, schema);

    const response = await source.chatCompletion(
      [{ role: MessageRole.User, content: prompt }],
      { model: model.externalId, temperature: 0.1, topP: 0 }
    );

    const confidences = parseClassificationResponse(response.text);

    // Determine which types pass threshold
    const activeTypes: QueryType[] = [];
    if (confidences.enumeration >= CONFIDENCE_THRESHOLD) {
      activeTypes.push('enumeration');
    }
    if (confidences.aggregation >= CONFIDENCE_THRESHOLD) {
      activeTypes.push('aggregation');
    }
    if (confidences.explanation >= CONFIDENCE_THRESHOLD) {
      activeTypes.push('explanation');
    }

    // If nothing passes threshold, fall back to explanation
    if (activeTypes.length === 0) {
      logger.warn('[QUERY-ROUTER] No type passed threshold, defaulting to explanation', {
        query: query.substring(0, 50),
        confidences,
      });
      return {
        confidences,
        activeTypes: ['explanation'],
        primaryType: 'explanation',
      };
    }

    // Primary type is the highest confidence among active types
    const primaryType = activeTypes.reduce((a, b) =>
      confidences[a] > confidences[b] ? a : b
    );

    logger.info('[QUERY-ROUTER] Classification complete', {
      query: query.substring(0, 50),
      confidences,
      activeTypes,
      primaryType,
    });

    return { confidences, activeTypes, primaryType };
  } catch (error) {
    logger.error('[QUERY-ROUTER] Classification failed, defaulting to explanation', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return defaultResult;
  }
}

/**
 * Parse the LLM classification response into multi-confidence scores.
 *
 * @param responseText - Raw LLM response text
 * @returns MultiConfidence with scores for each type
 */
function parseClassificationResponse(responseText: string): MultiConfidence {
  const defaultConfidences: MultiConfidence = {
    enumeration: 0,
    aggregation: 0,
    explanation: 0.5,
  };

  try {
    const cleaned = responseText
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('[QUERY-ROUTER] No JSON object found in classification response', { responseText: responseText.substring(0, 200) });
      return defaultConfidences;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      enumeration: typeof parsed.enumeration === 'number' ? parsed.enumeration : 0,
      aggregation: typeof parsed.aggregation === 'number' ? parsed.aggregation : 0,
      explanation: typeof parsed.explanation === 'number' ? parsed.explanation : 0,
    };
  } catch (error) {
    logger.warn('[QUERY-ROUTER] Failed to parse classification response', { responseText: responseText.substring(0, 200), error: error instanceof Error ? error.message : 'Unknown error' });
    return defaultConfidences;
  }
}

/**
 * Build the classification prompt for the LLM.
 * Schema-aware: routes to explanation if question is about content not in the graph.
 * Returns confidence scores for ALL types to enable hybrid queries.
 *
 * @param query - User's question
 * @param schema - Graph schema showing what's queryable
 * @returns Formatted prompt string
 */
function buildClassificationPrompt(query: string, schema: string): string {
  return `Classify this user question about a knowledge graph. Return confidence scores for ALL types.

GRAPH SCHEMA (what's actually queryable via Cypher):
${schema}

TYPES:
- enumeration: Lists of items that exist in the graph schema above (list all, show every, what entities, which documents, what is connected to X, what do they have in common)
- aggregation: Computed summaries about items in the graph schema above (count, how many, total, most common, statistics, breakdown by)
- explanation: Perform semantic graph search over the knowledge graph to find and retrieve relevant content. Use when the question is semantically similar to content that exists in the knowledge base. (e.g., "What does it say about X?", "How does Y work?") NOT: global, overview, statistical, or analytical questions where the query itself would not be semantically similar to any stored content

MULTI-LABEL CLASSIFICATION:
Some questions benefit from MULTIPLE approaches. Score each type independently (0.0-1.0).

EXAMPLES with multi-confidence:
- "List all entities" → { enumeration: 0.95, aggregation: 0.1, explanation: 0.1 }
- "How many people?" → { enumeration: 0.2, aggregation: 0.95, explanation: 0.1 }
- "What is PEO DHMS?" → { enumeration: 0.1, aggregation: 0.0, explanation: 0.95 }
- "What do these documents have in common?" → { enumeration: 0.8, aggregation: 0.3, explanation: 0.2 }
  (Global/overview question — enumeration lists shared entities; explanation score low because the query is not semantically similar to stored content)
- "Tell me about these documents" → { enumeration: 0.9, aggregation: 0.1, explanation: 0.1 }
  (Document overview — not semantically similar to any stored content)
- "What does it say about the funding process?" → { enumeration: 0.1, aggregation: 0.0, explanation: 0.95 }
  (Content question — answer lives in the text, semantically similar content exists in the knowledge base)
- "How does the approval workflow work?" → { enumeration: 0.1, aggregation: 0.0, explanation: 0.95 }
  (Process question — requires reading what the knowledge base actually says)
- "What is the relationship between X and Y?" → { enumeration: 0.3, aggregation: 0.0, explanation: 0.85 }
  (Relationship question — answer requires reading content, graph expansion provides context)

SCHEMA-AWARENESS RULE:
- If something IS in the schema (Entity types, Concepts, Relationships) → can score enumeration/aggregation high
- If something is NOT in schema (budget items, requirements, etc.) → only explanation should score high

Question: ${query}

Respond with JSON only: { "enumeration": 0.0-1.0, "aggregation": 0.0-1.0, "explanation": 0.0-1.0 }`;
}

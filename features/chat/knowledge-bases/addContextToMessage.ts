import { Citation } from '@/features/chat/types/message';
import { GraphContext } from '@/features/chat/dal/buildGraphContext';
import { formatGraphContextForLLM } from '@/features/chat/dal/formatGraphContext';
import { Text2CypherResult } from '@/features/graph-database/services/text2Cypher';
import logger from '@/server/logger';

/**
 * Add context to user message for LLM processing
 *
 * When useGraph=false (default): Uses simple format with document excerpts and generic rules.
 * When useGraph=true: Uses Knowledge Graph format with entities, concepts, chunks, and one-hop neighbors.
 *
 * @param message - Original user message
 * @param citations - Document/KB citations from vector search
 * @param useGraph - Whether graph mode is enabled
 * @param graphContext - Optional graph context with entities, concepts, chunks, and oneHopResults
 * @param chunkSummaries - Optional map of embeddingId -> summary for displaying summaries instead of full content
 * @returns Message with context added
 */
export default function addContextToMessage(
  message: string,
  citations: Citation[],
  useGraph: boolean = false,
  graphContext?: GraphContext,
  chunkSummaries?: Map<string, string>
): string {
  // Edge case: No context to add
  if (!citations.length && (!graphContext || (
    graphContext.entities.length === 0 &&
    graphContext.concepts.length === 0 &&
    graphContext.chunks.length === 0 &&
    graphContext.oneHopResults.length === 0
  ))) {
    return message;
  }

  // Graph-enhanced path: use Knowledge Graph format
  if (useGraph && graphContext) {
    const graphSection = formatGraphContextForLLM(graphContext, chunkSummaries);

    if (!graphSection) {
      // Fallback to simple format if graph formatting returns empty
      return formatSimpleContext(message, citations);
    }

    const updatedMessage = `
## User message:
${message}

## Retrieved Context:
${graphSection}
`;

    logger.info('[GRAPH-RAG] Context formatted with Knowledge Graph', {
      entities: graphContext.entities.length,
      concepts: graphContext.concepts.length,
      chunks: graphContext.chunks.length,
      oneHop: graphContext.oneHopResults.length,
    });

    return updatedMessage;
  }

  // Simple path (non-graph): main branch behavior
  return formatSimpleContext(message, citations);
}

/**
 * Format context in simple format (main branch behavior)
 */
function formatSimpleContext(message: string, citations: Citation[]): string {
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
2. If context is provided, you should ground your answer in this context.
3. You may supplement the context with additional information from the LLM to provide a more detailed and comprehensive response, but if you do, you must state that it is outside the context provided.
4. Do not use citations in the response.
`;

  return updatedMessage;
}

/**
 * Format text2cypher results as context for LLM
 */
export function formatText2CypherContext(result: Text2CypherResult): string {
  if (result.error || result.rowCount === 0) {
    return '';
  }

  let context = `**Query:** ${result.query}\n\n`;
  context += '```json\n';
  context += JSON.stringify(result.results, null, 2);
  context += '\n```\n';

  return context;
}

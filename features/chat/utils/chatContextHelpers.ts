import { Citation } from '@/features/chat/types/message';
import { ContextType as TrpcContextType } from '@/server/trpc-context';
import getUserKnowledgeBases from '@/features/shared/dal/getUserKnowledgeBases';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import getDocuments from '@/features/shared/dal/document-library/upload/getDocuments';
import getBedrockModelAccess from '@/features/shared/dal/getBedrockModelAccess';
import { embedContent } from '@/features/shared/dal/document-library/upload/embedContent';
import getEmbeddingsForDocuments from '@/features/chat/dal/getEmbeddingsForDocuments';
import getContentFromKbs, { KbResults } from '@/features/chat/knowledge-bases/getContentFromKbs';
import getEntitiesForQuery from '@/features/chat/dal/getEntitiesForQuery';
import getConceptsForQuery from '@/features/chat/dal/getConceptsForQuery';
import { buildGraphContext, GraphContext } from '@/features/chat/dal/buildGraphContext';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';
import { UsageAttribution } from '@/features/ai-provider/sources/AiProviderUsageTracker';
import logger from '@/server/logger';

/**
 * Result from processing documents for RAG
 */
export interface ProcessDocumentsResult {
  citations: Citation[];
  graphContext?: GraphContext;
}

/**
 * System context needed for chat completions
 */
export type SystemContext = {
  userKnowledgeBases: any[];
  selectedKnowledgeBases: any[];
  hasDocumentLibrary: boolean;
  documentsWithSelectionState: any[];
};

/**
 * Build system message context (knowledge bases and documents)
 *
 * This consolidates the logic for:
 * - Fetching user knowledge bases
 * - Checking document library access
 * - Building document selection state
 *
 * Used by both add-message route and chat worker.
 */
export async function buildSystemContext(
  userId: string,
  knowledgeBaseIds: string[],
  documentIds: string[]
): Promise<SystemContext> {
  // Knowledge Bases
  const userKnowledgeBases = await getUserKnowledgeBases(userId);
  const selectedKnowledgeBases = userKnowledgeBases.filter(
    kb => knowledgeBaseIds.includes(kb.id)
  );

  // Document Library
  const systemConfig = await getSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || null;
  const hasBedrockModelAccess = await getBedrockModelAccess(userId);
  const hasDocumentLibrary = !!(documentUploadProviderId && hasBedrockModelAccess);

  const userDocuments = await getDocuments({
    userId,
    documentUploadProviderId,
  });

  const documentsWithSelectionState = userDocuments.map(doc => ({
    ...doc,
    selected: documentIds.includes(doc.id),
  }));

  return {
    userKnowledgeBases,
    selectedKnowledgeBases,
    hasDocumentLibrary,
    documentsWithSelectionState,
  };
}

/**
 * Process documents to generate embeddings and retrieve citations
 *
 * When useGraph=true, also searches for entities and concepts and builds
 * a flat GraphContext (LightRAG-style) where entities, concepts, and
 * relationships are peer sections rather than attached to chunks.
 *
 * @param message - User message to embed
 * @param userId - User ID for embedding
 * @param documentIds - Documents to search
 * @param throwOnError - Whether to throw on embedding failure (route) or return empty (worker)
 * @param useGraph - Whether to also search entity/concept embeddings and build graph context
 * @param attribution - What this retrieval belongs to (chat message, or workflow
 *   execution + primitive), so its embedding spend can be totalled per artifact.
 *   Omitted by callers that have no such context; the row then reads as
 *   unattributed rather than as free.
 * @returns ProcessDocumentsResult with citations and optional graphContext
 */
export async function processDocuments(
  message: string,
  userId: string,
  documentIds: string[],
  throwOnError: boolean = false,
  useGraph: boolean = false,
  attribution?: UsageAttribution,
): Promise<ProcessDocumentsResult> {
  if (documentIds.length === 0) {
    return { citations: [] };
  }

  const accessibleDocIds = await getAccessibleDocumentIds(userId);
  const allowedDocIds = documentIds.filter((id) => accessibleDocIds.has(id));
  if (allowedDocIds.length === 0) {
    logger.warn('[CHAT] No accessible documents in request; silently filtering', {
      userId,
      requestedCount: documentIds.length,
    });
    return { citations: [] };
  }

  const embeddedContent = await embedContent(message, userId, undefined, attribution);

  if (!embeddedContent.embeddings?.length) {
    if (throwOnError) {
      throw new Error('Something went wrong embedding your message. Please try again later');
    }
    return { citations: [] };
  }

  const embeddedQuery = embeddedContent.embeddings[0].embedding;

  // Use stricter threshold (0.35) when graph is enabled for higher precision anchors
  // Use looser threshold (0.15) when graph is disabled to maximize recall
  const minThreshold = useGraph ? 0.35 : 0.15;

  const embeddingResult = await getEmbeddingsForDocuments({
    userId,
    embeddedQuery,
    documentIds: allowedDocIds,
    accessibleDocIds,
    minThreshold,
  });

  const citations = embeddingResult.map((context) => context.citation);
  let graphContext: GraphContext | undefined;

  // When graph mode is enabled, build flat graph context (LightRAG-style)
  if (useGraph) {
    try {
      const [entityResults, conceptResults] = await Promise.all([
        getEntitiesForQuery({ embeddedQuery, documentIds: allowedDocIds, accessibleDocIds }),
        getConceptsForQuery({ embeddedQuery, documentIds: allowedDocIds, accessibleDocIds }),
      ]);

      logger.info(
        `[GRAPH-RAG] Found ${entityResults.length} entities, ${conceptResults.length} concepts`
      );

      graphContext = await buildGraphContext(entityResults, conceptResults, allowedDocIds, citations);
    } catch (error) {
      logger.warn('[GRAPH-RAG] Graph context build failed, continuing without it', { error });
    }
  }

  return { citations, graphContext };
}

/**
 * Retrieve knowledge base content and return citations
 *
 * @param ctx - Full context with userId, kb, logger, etc.
 * @param message - User message
 * @param knowledgeBaseIds - Knowledge bases to search
 * @returns KB results with citations and failed KBs
 */
export async function processKnowledgeBases(
  ctx: TrpcContextType,
  message: string,
  knowledgeBaseIds: string[]
): Promise<KbResults> {
  if (knowledgeBaseIds.length === 0) {
    return { citations: [], failedKbs: [] };
  }

  return await getContentFromKbs(ctx, { message, knowledgeBaseIds });
}

/**
 * Combine all citations from documents and knowledge bases
 */
export function combineCitations(
  documentCitations: Citation[],
  kbCitations: Citation[]
): Citation[] {
  return [...kbCitations, ...documentCitations];
}

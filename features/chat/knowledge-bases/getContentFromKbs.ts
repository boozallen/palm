import { ContextType } from '@/server/trpc-context';
import { SearchResult } from '@/features/kb-provider/sources/types';
import { maxResults as defaultMaxResults, minScore as defaultMinScore } from '@/features/shared/utils/kbProvider';
import logger from '@/server/logger';
import getUserAdvancedKbSettings from '@/features/shared/dal/getUserAdvancedKbSettings';
import { Citation } from '@/features/chat/types/message';
import { ContextType as CitationContextType } from '@/features/chat/types/message';

export type KbResults = {
  citations: Citation[],
  failedKbs: string[],
};

type getContentInput = {
  message: string,
  knowledgeBaseIds: string[],
}

export default async function getContentFromKbs(ctx: ContextType, input: getContentInput): Promise<KbResults> {
  let citations: Citation[] = [];
  let failedKbs: string[] = [];
  let resultsArray: { content: string, score: number, sourceLabel?: string, knowledgeBaseId: string }[] = [];

  const userAdvancedKbSettings = await getUserAdvancedKbSettings(ctx.userId);
  const maxResults = userAdvancedKbSettings.knowledgeBasesMaxResults ?? defaultMaxResults;
  const minScore = userAdvancedKbSettings.knowledgeBasesMinScore ?? defaultMinScore;
  const { message, knowledgeBaseIds } = input;

  const kbPromises = knowledgeBaseIds.map(async (knowledgeBaseId) => {
    let kb;
    try {
      // creates a new instance of the KBFactory class and returns source, provider, and knowledgebase
      kb = await ctx.kb.buildSource(knowledgeBaseId);

      // search knowledge base documents for content related to the user's message, returns content, score, and citations for each result
      let kbContent = await kb.source.search({ knowledgeBaseId: kb.knowledgeBase.externalId, message, maxResults, minScore });

      kbContent.results.forEach((result: SearchResult) => {
        resultsArray.push({
          content: result.content,
          score: result.score,
          sourceLabel: result.citation?.label,
          knowledgeBaseId: knowledgeBaseId,
        });
      });

    } catch (error) {
      logger.error(`Error fetching data for knowledge base ID ${knowledgeBaseId}:`, error);
      failedKbs.push(kb?.knowledgeBase.label || 'Unidentified Knowledge Base');
    }
  });
  await Promise.allSettled(kbPromises);

  resultsArray.sort((a, b) => b.score - a.score);
  resultsArray = resultsArray.slice(0, maxResults);

  resultsArray.forEach(result => {
    if (result.sourceLabel) {
      citations.push({
        contextType: CitationContextType.KNOWLEDGE_BASE,
        knowledgeBaseId: result.knowledgeBaseId,
        sourceLabel: result.sourceLabel,
        citation: result.content,
      });
    }
  });

  return { citations, failedKbs };
}

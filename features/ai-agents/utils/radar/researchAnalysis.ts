import axios, { AxiosResponse } from 'axios';
import Bottleneck from 'bottleneck';
import { XMLParser } from 'fast-xml-parser';

import {
  createCategoryQuery,
  createDateQuery,
} from '@/features/ai-agents/utils/radar/queries';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import {
  ApiResponse,
  ARXIV_TO_RESEARCH_CATEGORY,
  ResearchPaper,
} from '@/features/ai-agents/types/radar/researchAgent';
import { filterByInstitution } from '@/features/ai-agents/utils/radar/filters';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import analyzePapers from '@/features/ai-agents/utils/radar/analyzePapers';
import { AIFactory } from '@/features/ai-provider/factory';
import { logger } from '@/server/logger';
import { AiAgentType } from '@/features/shared/types';

export type ResearchAnalysisParams = {
  agentId: string;
  dateStart: string;
  dateEnd: string;
  categories: string[];
  institutions: string[];
  model: string;
  userId: string;
  limiter: Bottleneck;
  onProgress: (message: string) => Promise<void>;
};

export type ResearchAnalysisResult = {
  papers: ResearchPaper[];
  paperCount: number;
  institutionCount: number;
  categoryCount: Record<string, number>;
  analysis: string;
};

export async function performResearchAnalysis({
  agentId,
  dateStart,
  dateEnd,
  categories,
  institutions,
  model,
  userId,
  limiter,
  onProgress,
}: ResearchAnalysisParams): Promise<ResearchAnalysisResult> {

  const agents = await getAvailableAgents(userId);
  const agent = agents
    .find((agent) => agent.id === agentId && agent.type === AiAgentType.RADAR);

  if (!agent) {
    logger.warn('Attempting to use unavailable research agent');
    throw new Error('The requested resource was not found');
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '_',
    isArray: (name) => ['entry', 'author', 'category'].includes(name),
    parseTagValue: true,
    trimValues: true,
  });

  limiter.on('error', (error) => {
    logger.error('Bottleneck error:', error);
  });

  await onProgress('Generating search query...');
  const searchQueryParts = [
    createDateQuery(dateStart, dateEnd),
    createCategoryQuery(categories),
  ].filter(Boolean);

  const searchQuery = searchQueryParts.join(' AND ');

  logger.debug(`Final search query: ${searchQuery}`);

  let startIndex = 0;
  let totalResults = Infinity;
  const batchSize = 750;
  const papers: ResearchPaper[] = [];
  let res: AxiosResponse<any, any>;
  let attempts = 0;
  const maxAttempts = 8;

  await onProgress('Starting to fetch articles from arXiv...');
  while (startIndex <= totalResults) {
    const params = {
      search_query: searchQuery,
      sortBy: 'submittedDate',
      sortOrder: 'descending',
      start: startIndex,
      max_results: batchSize,
    };

    logger.info(`Fetching articles with params: ${JSON.stringify(params)}`);
    try {
      res = await limiter.schedule(() =>
        axios.get('https://export.arxiv.org/api/query', {
          params,
          timeout: 30000,
          responseType: 'text',
        })
      );
    } catch (error) {
      logger.error('Error fetching articles:', error);
      throw new Error('Error fetching articles. Please try again later.');
    }

    const parsedData: ApiResponse = parser.parse(res.data);

    if (totalResults === Infinity) {
      totalResults = parsedData.feed['opensearch:totalResults']['#text'];
      await onProgress(`Found ${totalResults} total articles to process...`);
    }

    const entries = parsedData.feed.entry;
    if (!entries || !Array.isArray(entries)) {
      logger.debug('Entries not found in the response', {
        rawResponse: res.data,
        url: res.config.url,
      });
      if (attempts < maxAttempts) {
        attempts++;
        logger.debug(`Retrying... Attempt ${attempts} of ${maxAttempts}`);
        continue;
      } else {
        break;
      }
    }

    logger.debug(`Processing ${startIndex + entries.length} out of ${totalResults} articles...`);

    // If received entry, reset attempts
    attempts = 0;

    await onProgress('Filtering articles by institution...');
    const filteredPapers = filterByInstitution(entries, institutions);

    logger.debug(
      `Filtered out ${entries.length - filteredPapers.length
      } articles based on institution, leaving ${filteredPapers.length} articles.`
    );

    filteredPapers.forEach((paper) => {
      const authors: string[] = paper.author.map((author) => author.name);
      const paperCategories: string[] = [];

      paper.category.forEach((category) => {
        if (
          category['_term'] &&
          ARXIV_TO_RESEARCH_CATEGORY[category['_term']]
        ) {
          paperCategories.push(ARXIV_TO_RESEARCH_CATEGORY[category['_term']]);
        } else {
          logger.debug(
            `Category ${category['_term']} not found in ARXIV_TO_RESEARCH_CATEGORY`
          );
        }
      });

      papers.push({
        id: paper.id,
        updated: paper.updated,
        published: paper.published,
        title: paper.title,
        summary: paper.summary,
        authors: authors,
        institutions: paper.institutions,
        categories: paperCategories,
      });
    });

    if (entries.length === 0 || startIndex + entries.length >= totalResults) {
      await onProgress(
        `Processed ${startIndex + entries.length} out of ${totalResults} articles...`
      );
      logger.debug('No more articles to fetch...');
      break;
    }

    // Update progress periodically
    await onProgress(
      `Processed ${startIndex + entries.length} out of ${totalResults} articles...`
    );

    startIndex += entries.length;
  }

  // Get the institutions from filtered articles;
  const totalInstitutions = new Set<string>();
  papers.forEach((paper) => {
    paper.institutions.forEach((institution) => {
      totalInstitutions.add(institution);
    });
  });

  // Get the category count from the filtered papers
  const categoryCount: Record<string, number> = {};
  papers.forEach((paper) => {
    paper.categories.forEach((category) => {
      if (categoryCount[category]) {
        categoryCount[category]++;
      } else {
        categoryCount[category] = 1;
      }
    });
  });

  let analysis: string = '';
  if (papers.length) {
    await onProgress('Starting AI analysis of papers...');

    try {
      const ai = new AIFactory({ userId });
      const aiSource = await ai.buildUserSource(model);
      const aiAdapter = new AiFactoryCompletionAdapter(aiSource);

      analysis = await analyzePapers(
        papers,
        aiAdapter,
        dateStart,
        dateEnd
      );

      logger.debug('LLM analysis completed');
      logger.info('LLM analysis result:', analysis);
    } catch (llmError: unknown) {
      logger.error(`LLM analysis failed: ${llmError}`);
      analysis = '';
    }
  } else {
    logger.debug('No papers found, skipping LLM analysis');
  }

  await onProgress('Research analysis complete!');

  return {
    papers: papers,
    paperCount: papers.length,
    institutionCount: totalInstitutions.size,
    categoryCount: categoryCount,
    analysis: analysis,
  };
}

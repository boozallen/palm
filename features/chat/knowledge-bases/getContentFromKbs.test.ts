import getContentFromKbs from '@/features/chat/knowledge-bases/getContentFromKbs';
import { ContextType } from '@/server/trpc-context';
import { maxResults as defaultMaxResults, minScore as defaultMinScore } from '@/features/shared/utils/kbProvider';
import logger from '@/server/logger';
import getUserAdvancedKbSettings from '@/features/shared/dal/getUserAdvancedKbSettings';

jest.mock('@/features/shared/dal/getUserAdvancedKbSettings');

type getContentInput = {
  message: string,
  knowledgeBaseIds: string[],
}

describe('getContentFromKbs', () => {
  let ctx: ContextType;
  let input: getContentInput;

  const buildSource = jest.fn();

  const knowledgeBaseOneId = '1';
  const knowledgeBaseOneLabel = 'Color Theory';
  const documentOne = 'Color Theory Document';

  const knowledgeBaseTwoId = '2';
  const knowledgeBaseTwoLabel = 'Color For Dummies';
  const documentTwo = 'Color For Dummies Document';

  beforeEach(() => {
    ctx = {
      kb: {
        buildSource,
      },
    } as unknown as ContextType;
    input = {
      message: 'What is the best color?',
      knowledgeBaseIds: [knowledgeBaseOneId, knowledgeBaseTwoId],
    };

    (getUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      knowledgeBaseMinScore: null,
      knowledgeBasesMaxResults: null,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return results with no failed knowledge bases', async () => {
    const kb1 = {
      source: {
        search: jest.fn(() => ({
          results: [
            { content: 'The best color is clearly green.', score: 0.85, citation: { label: documentOne } },
          ],
        })),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };
    const kb2 = {
      source: {
        search: jest.fn(() => ({
          results: [
            { content: 'In many cultures, red symbolizes love, energy, and sometimes danger.', score: 0.75, citation: { label: documentTwo } },
          ],
        })),
      },
      knowledgeBase: { externalId: knowledgeBaseTwoId, label: knowledgeBaseTwoLabel },
    };

    buildSource.mockResolvedValueOnce(kb1).mockResolvedValueOnce(kb2);

    const result = await getContentFromKbs(ctx, input);

    expect(result).toEqual({
      content: `Content:The best color is clearly green. (Citation: ${documentOne}, Score: 0.85)\nContent:In many cultures, red symbolizes love, energy, and sometimes danger. (Citation: ${documentTwo}, Score: 0.75)`,
      citations: [
        {
          citation: documentOne,
          knowledgeBaseId: knowledgeBaseOneId,
        },
        {
          citation: documentTwo,
          knowledgeBaseId: knowledgeBaseTwoId,
        },
      ],
      failedKbs: [],
    });
  });

  it('should return results with failed knowledge bases', async () => {
    const expectedError = new Error('Unable to fetch data');
    const kb1 = {
      source: {
        search: jest.fn(() => {
          throw expectedError;
        }),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };
    const kb2 = {
      source: {
        search: jest.fn(() => ({
          results: [
            { content: 'In many cultures, red symbolizes love, energy, and sometimes danger.', score: 0.75, citation: { label: documentTwo } },
          ],
        })),
      },
      knowledgeBase: { externalId: knowledgeBaseTwoId, label: knowledgeBaseTwoLabel },
    };

    buildSource.mockResolvedValueOnce(kb1).mockResolvedValueOnce(kb2);

    const result = await getContentFromKbs(ctx, input);

    expect(logger.error).toHaveBeenCalledWith(`Error fetching data for knowledge base ID ${input.knowledgeBaseIds[0]}:`, expectedError);
    expect(result).toEqual({
      content: `Content:In many cultures, red symbolizes love, energy, and sometimes danger. (Citation: ${documentTwo}, Score: 0.75)`,
      citations: [
        {
          citation: documentTwo,
          knowledgeBaseId: knowledgeBaseTwoId,
        },
      ],
      failedKbs: [knowledgeBaseOneLabel],
    });
  });

  it('should return content from kbs equal to or less than user-defined maxResults', async () => {
    const maxResults = 10;
    (getUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      knowledgeBaseMinScore: null,
      knowledgeBasesMaxResults: maxResults,
    });
    const kb1 = {
      source: {
        search: jest.fn(() => ({
          results: Array.from({ length: maxResults + 5 }, (_, i) => ({
            content: `Content ${i + 1}`,
            score: 0.9 - i * 0.01,
            citation: { label: `Document ${i + 1}` },
          })),
        })),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };

    buildSource.mockResolvedValueOnce(kb1);

    const result = await getContentFromKbs(ctx, input);

    const contentLines = result.content.trim().split('\n');
    const citationCount = result.citations.length;

    expect(contentLines.length).toBe(maxResults);
    expect(citationCount).toBe(maxResults);

    const topResults = Array.from({ length: maxResults }, (_, i) => `Content:${kb1.source.search().results[i].content}`);
    topResults.forEach((line, index) => {
      expect(contentLines[index]).toContain(line);
    });
  });

  it('should use default maxResults when maxResults is not set in User table', async () => {
    const kb1 = {
      source: {
        search: jest.fn(() => ({
          results: Array.from({ length: defaultMaxResults + 5 }, (_, i) => ({
            content: `Content ${i + 1}`,
            score: 0.9 - i * 0.01,
            citation: { label: `Document ${i + 1}` },
          })),
        })),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };

    buildSource.mockResolvedValueOnce(kb1);

    const { citations } = await getContentFromKbs(ctx, input);

    expect(citations.length).toBe(defaultMaxResults);
  });

  it('should use default minScore when minScore is not set in User table', async () => {
    const search = jest.fn();
    const newInput = {
      ...input,
      knowledgeBaseIds: [knowledgeBaseOneId],
    };
    const kb1 = {
      source: {
        search: search.mockResolvedValue({
          results: [
            { content: 'The best color is clearly green.', score: 0.85, citation: { label: documentOne } },
          ],
        }),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };
    buildSource.mockResolvedValue(kb1);

    await getContentFromKbs(ctx, newInput);

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ minScore: defaultMinScore }));
  });

  it('should use user-defined minScore if available', async () => {
    const minScore = 0.7;
    (getUserAdvancedKbSettings as jest.Mock).mockReturnValue({
      knowledgeBaseMinScore: minScore,
      knowledgeBasesMaxResults: null,
    });

    const search = jest.fn();
    const newInput = {
      ...input,
      knowledgeBaseIds: [knowledgeBaseOneId],
    };
    const kb1 = {
      source: {
        search: search.mockResolvedValue({
          results: [
            { content: 'The best color is clearly green.', score: 0.85, citation: { label: documentOne } },
          ],
        }),
      },
      knowledgeBase: { externalId: knowledgeBaseOneId, label: knowledgeBaseOneLabel },
    };
    buildSource.mockResolvedValue(kb1);

    await getContentFromKbs(ctx, newInput);

    expect(search).toHaveBeenCalledWith(expect.objectContaining({ minScore: defaultMinScore }));
  });
});

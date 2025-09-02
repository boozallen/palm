import axios from 'axios';

import { performResearchAnalysis } from './researchAnalysis';
import getAvailableAgents from '@/features/shared/dal/getAvailableAgents';
import analyzePapers from '@/features/ai-agents/utils/radar/analyzePapers';
import { AiAgentType } from '@/features/shared/types';

jest.mock('axios');
jest.mock('bottleneck', () => {
  return jest.fn().mockReturnValue({
    schedule: jest.fn((fn: any) => fn()),
    on: jest.fn(),
  });
});

jest.mock('@/features/shared/dal/getAvailableAgents');
jest.mock('@/features/ai-agents/utils/radar/filters', () => ({
  filterByInstitution: jest.fn((papers: any, institutions: any) => papers.map((paper: any) => ({ ...paper, institutions }))),
}));

jest.mock('@/features/ai-provider/factory', () => ({
  AIFactory: jest.fn().mockImplementation(() => ({
    buildUserSource: jest.fn().mockResolvedValue({
      complete: jest.fn().mockResolvedValue({ text: 'Mock LLM response' }),
    }),
  })),
}));

jest.mock('@/features/ai-agents/utils/aiFactoryCompletionAdapter', () => ({
  AiFactoryCompletionAdapter: jest.fn().mockImplementation(() => ({
    complete: jest.fn().mockResolvedValue({ text: 'Mock LLM response' }),
  })),
}));

jest.mock('@/features/ai-agents/utils/radar/analyzePapers');

const mockAxiosGet = axios.get as jest.Mock;

describe('performResearchAnalysis', () => {
  const mockParams = {
    agentId: 'da471317-b9a3-436a-a6e1-5bf0a8e661eb',
    dateStart: '2023-01-01',
    dateEnd: '2023-12-31',
    categories: ['cs.AI'],
    institutions: ['Stanford University'],
    model: 'da1d36f4-56d7-43f0-baba-2459d0843f9e',
    userId: 'test-user-123',
    limiter: new (require('bottleneck'))(),
    onProgress: jest.fn(),
  };

  const mockAxiosResponse = {
    data: `
      <feed>
        <opensearch:totalResults xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">1</opensearch:totalResults>
        <opensearch:startIndex xmlns:opensearch="http://a9.com/-/spec/opensearch/1.1/">0</opensearch:startIndex>
        <entry>
          <id>http://arxiv.org/abs/2301.00001</id>
          <updated>2023-01-01T00:00:00Z</updated>
          <published>2023-01-01T00:00:00Z</published>
          <title>Sample Research Paper</title>
          <summary>This is a summary.</summary>
          <author>
            <name>John Doe</name>
            <arxiv:affiliation xmlns:arxiv="http://arxiv.org/schemas/atom">Stanford University</arxiv:affiliation>
          </author>
          <category term="cs.AI" />
        </entry>
      </feed>
    `,
  };

  const mockAvailableAgents = [
    {
      id: 'da471317-b9a3-436a-a6e1-5bf0a8e661eb',
      label: 'Test Agent',
      type: AiAgentType.RADAR,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxiosGet.mockResolvedValue(mockAxiosResponse);
    (getAvailableAgents as jest.Mock).mockResolvedValue(mockAvailableAgents);
    (analyzePapers as jest.Mock).mockResolvedValue('Mock analysis result');
  });

  it('should call onProgress with messages', async () => {
    await performResearchAnalysis(mockParams);

    expect(mockParams.onProgress).toHaveBeenCalledWith('Generating search query...');
    expect(mockParams.onProgress).toHaveBeenCalledWith('Starting to fetch articles from arXiv...');
    expect(mockParams.onProgress).toHaveBeenCalledWith('Research analysis complete!');
  });

  it('should make API call to arXiv', async () => {
    await performResearchAnalysis(mockParams);

    expect(mockAxiosGet).toHaveBeenCalledWith(
      'https://export.arxiv.org/api/query',
      expect.objectContaining({
        params: expect.objectContaining({
          search_query: expect.stringContaining('cs.AI'),
        }),
        timeout: 30000,
        responseType: 'text',
      })
    );
  });

  it('should return correct result structure', async () => {
    const result = await performResearchAnalysis(mockParams);

    expect(result).toEqual(
      expect.objectContaining({
        papers: expect.any(Array),
        paperCount: expect.any(Number),
        institutionCount: expect.any(Number),
        categoryCount: expect.any(Object),
        analysis: expect.any(String),
      })
    );
  });
});

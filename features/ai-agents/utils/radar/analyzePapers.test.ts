import { ResearchPaper } from '@/features/ai-agents/types/radar/researchAgent';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import analyzePapers from './analyzePapers';

jest.mock('@/features/shared/utils', () => ({
  getPromptById: jest.fn(),
  insertRequestValuesIntoPrompt: jest.fn(),
}));

const mockPapers: ResearchPaper[] = [
  {
    id: '1',
    updated: '2025-05-01T00:00:00Z',
    published: '2025-05-01T00:00:00Z',
    title: 'Novel Breakthrough in Machine Learning',
    summary:
      'This paper presents a novel approach that outperforms state-of-the-art methods with superior efficiency and scalability.',
    authors: ['John Doe', 'Jane Smith', 'Bob Johnson'],
    institutions: ['MIT', 'Stanford University'],
    categories: ['cs.LG', 'cs.AI'],
  },
  {
    id: '2',
    updated: '2025-05-02T00:00:00Z',
    published: '2025-05-02T00:00:00Z',
    title: 'Enhanced Computer Vision Techniques',
    summary:
      'An improved method for image processing with real-world deployment capabilities.',
    authors: ['Alice Brown'],
    institutions: ['University of California Berkeley'],
    categories: ['cs.CV'],
  },
  {
    id: '3',
    updated: '2025-05-03T00:00:00Z',
    published: '2025-05-03T00:00:00Z',
    title: 'Survey of Natural Language Processing',
    summary: 'A comprehensive review and analysis of recent NLP developments.',
    authors: ['Charlie Wilson', 'Diana Davis'],
    institutions: ['Carnegie Mellon University'],
    categories: ['cs.CL'],
  },
  {
    id: '4',
    updated: '2025-05-04T00:00:00Z',
    published: '2025-05-04T00:00:00Z',
    title: 'Standard Research in Optimization',
    summary: 'Basic optimization techniques for general applications.',
    authors: ['Eve Miller'],
    institutions: ['Generic University'],
    categories: ['cs.DS'],
  },
] as unknown as ResearchPaper[];

const mockAiAdapter = {
  complete: jest.fn(),
} as unknown as AiFactoryCompletionAdapter;

const {
  getPromptById,
  insertRequestValuesIntoPrompt,
} = require('@/features/shared/utils');

describe('analyzePapers', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    getPromptById.mockReturnValue({
      id: 'research-analysis',
      instructions:
        'Mock prompt with {req.paperCount} papers from {req.timeframe}',
    });

    insertRequestValuesIntoPrompt.mockReturnValue(
      'Processed prompt with actual values'
    );

    mockAiAdapter.complete = jest.fn().mockResolvedValue({
      text: 'Mock LLM analysis response',
    });

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should successfully analyze papers and return LLM response', async () => {
    const result = await analyzePapers(
      mockPapers,
      mockAiAdapter,
      '2025-05-01T00:00:00Z',
      '2025-05-31T00:00:00Z'
    );

    expect(result).toBe('Mock LLM analysis response');
    expect(mockAiAdapter.complete).toHaveBeenCalledWith({
      prompt: 'Processed prompt with actual values',
    });
  });

  it('should handle empty papers array', async () => {
    const result = await analyzePapers(
      [],
      mockAiAdapter,
      '2025-05-01T00:00:00Z',
      '2025-05-31T00:00:00Z'
    );

    expect(result).toBe('Mock LLM analysis response');
    expect(insertRequestValuesIntoPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        paperCount: '0',
        notablePaperCount: '0',
      }),
      expect.any(String)
    );
  });

  it('should throw error when prompt is not found', async () => {
    getPromptById.mockReturnValue(null);

    await expect(
      analyzePapers(
        mockPapers,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      )
    ).rejects.toThrow('Research analysis prompt not found');
  });

  it('should throw error when LLM call fails', async () => {
    mockAiAdapter.complete = jest
      .fn()
      .mockRejectedValue(new Error('API Error'));

    await expect(
      analyzePapers(
        mockPapers,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      )
    ).rejects.toThrow('Research analysis failed: API Error');
  });

  it('should format dates correctly', async () => {
    await analyzePapers(
      mockPapers,
      mockAiAdapter,
      '2025-01-01T00:00:00Z',
      '2025-02-01T00:00:00Z'
    );

    expect(insertRequestValuesIntoPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        timeframe: '1/1/2025 to 2/1/2025',
      }),
      expect.any(String)
    );
  });

  it('should pass correct prompt values', async () => {
    await analyzePapers(
      mockPapers,
      mockAiAdapter,
      '2025-05-01T00:00:00Z',
      '2025-05-31T00:00:00Z'
    );

    expect(insertRequestValuesIntoPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        paperCount: '4',
        timeframe: expect.any(String),
        contextSummary: expect.stringContaining('4 papers'),
        topInstitutions: expect.any(String),
        topCategories: expect.any(String),
        categoryDistribution: expect.any(String),
        institutionInsights: expect.any(String),
        notablePaperCount: expect.any(String),
        notableSummaries: expect.any(String),
      }),
      expect.any(String)
    );
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Helper Functions', () => {
  describe('Paper Selection and Scoring', () => {
    it('should select high-scoring papers based on keywords', async () => {
      await analyzePapers(
        mockPapers,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      );

      const callArgs = insertRequestValuesIntoPrompt.mock.calls[0][0];

      // The highest scoring paper should appear first
      expect(callArgs.notableSummaries).toContain(
        'Novel Breakthrough in Machine Learning'
      );

      // Verify it appears before the low-scoring papers
      const summaries = callArgs.notableSummaries;
      const novelIndex = summaries.indexOf(
        'Novel Breakthrough in Machine Learning'
      );
      const surveyIndex = summaries.indexOf(
        'Survey of Natural Language Processing'
      );

      // Novel paper should appear before survey paper (surveys typically score lower)
      expect(novelIndex).toBeLessThan(surveyIndex);
    });

    it('should handle papers with no institutions', async () => {
      const papersWithoutInstitutions: ResearchPaper[] = mockPapers.map(
        (paper) => ({
          ...paper,
          institutions: [],
        })
      );

      const result = await analyzePapers(
        papersWithoutInstitutions,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      );

      expect(result).toBe('Mock LLM analysis response');
    });

    it('should handle papers with empty summaries', async () => {
      const papersWithEmptySummaries = mockPapers.map((paper) => ({
        ...paper,
        summary: '',
      }));

      const result = await analyzePapers(
        papersWithEmptySummaries,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      );

      expect(result).toBe('Mock LLM analysis response');
    });
  });

  describe('Institution Analysis', () => {
    it('should analyze institution distribution correctly', async () => {
      await analyzePapers(
        mockPapers,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      );

      const callArgs = insertRequestValuesIntoPrompt.mock.calls[0][0];

      expect(callArgs.topInstitutions).toContain('MIT');
      expect(callArgs.topInstitutions).toContain('Stanford University');

      expect(callArgs.institutionInsights).toContain('MIT: 1 papers (25%)');
    });
  });

  describe('Category Analysis', () => {
    it('should analyze category distribution correctly', async () => {
      await analyzePapers(
        mockPapers,
        mockAiAdapter,
        '2025-05-01T00:00:00Z',
        '2025-05-31T00:00:00Z'
      );

      const callArgs = insertRequestValuesIntoPrompt.mock.calls[0][0];

      expect(callArgs.categoryDistribution).toContain('cs.LG: 1 papers (25%)');
      expect(callArgs.categoryDistribution).toContain('cs.CV: 1 papers (25%)');
      expect(callArgs.categoryDistribution).toContain(
        'Specialized research area with potential applications'
      );
    });
  });
});

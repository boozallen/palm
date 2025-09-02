import {
  ResearchPaper,
  ResearchCategory,
  ARXIV_TO_RESEARCH_CATEGORY,
} from '@/features/ai-agents/types/radar/researchAgent';
import { AiFactoryCompletionAdapter } from '@/features/ai-agents/utils/aiFactoryCompletionAdapter';
import {
  getPromptById,
  insertRequestValuesIntoPrompt,
} from '@/features/shared/utils';
import { researchAnalysisPrompts } from '@/features/ai-agents/data/prompts';

export default async function analyzePapers(
  papers: ResearchPaper[],
  aiAdapter: AiFactoryCompletionAdapter,
  dateStart: string,
  dateEnd: string
): Promise<string> {
  const institutionAnalysis = analyzeInstitutionalContext(papers);
  const categoryStats = calculateCategoryStats(papers);
  const topCategories = Object.entries(categoryStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  const notablePapers = selectNotablePapers(papers);

  const notableSummaries = notablePapers
    .map(
      (paper, index) =>
        `${index + 1}. **'${paper.title}'**\n` +
        `   - Authors: ${paper.authors.slice(0, 3).join(', ')}${
          paper.authors.length > 3 ? ' et al.' : ''
        }\n` +
        `   - Institution(s): ${
          paper.institutions?.slice(0, 2).join(', ') || 'Not specified'
        }\n` +
        `   - Research Areas: ${paper.categories.slice(0, 3).join(', ')}\n` +
        `   - Research Focus: ${extractResearchKeywords(paper.summary).join(
          ', '
        )}\n` +
        `   - Innovation Level: ${assessInnovationLevel(
          paper.title,
          paper.summary
        )}`
    )
    .join('\n\n');

  const analysisPrompt = getPromptById(
    researchAnalysisPrompts,
    'research-analysis'
  );
  if (!analysisPrompt) {
    throw new Error('Research analysis prompt not found');
  }

  const promptValues = {
    paperCount: papers.length.toString(),
    timeframe: `${new Date(dateStart).toLocaleDateString('en-US')} to ${new Date(dateEnd).toLocaleDateString('en-US')}`,
    contextSummary: institutionAnalysis.contextSummary,
    topInstitutions: institutionAnalysis.topInstitutions
      .slice(0, 8)
      .map(([inst, count]) => `${inst} (${count})`)
      .join(', '),
    topCategories: topCategories
      .slice(0, 6)
      .map(([cat, count]) => `${cat} (${count})`)
      .join(', '),
    categoryDistribution: topCategories
      .map(
        ([category, count]) =>
          `- ${category}: ${count} papers (${Math.round(
            (count / papers.length) * 100
          )}%) - ${getResearchImportanceByName(category)}`
      )
      .join('\n'),
    institutionInsights: institutionAnalysis.institutionInsights,
    notablePaperCount: notablePapers.length.toString(),
    notableSummaries: notableSummaries,
  };

  const prompt = insertRequestValuesIntoPrompt(
    promptValues,
    analysisPrompt.instructions
  );

  try {
    const completionResponse = await aiAdapter.complete({
      prompt: prompt,
    });

    return completionResponse.text;
  } catch (error: any) {
    console.error('Research analysis error:', error);
    throw new Error(`Research analysis failed: ${error.message}`);
  }
}

function analyzeInstitutionalContext(papers: ResearchPaper[]) {
  const institutionStats: Record<string, number> = {};

  papers.forEach((paper) => {
    paper.institutions?.forEach((inst) => {
      if (inst && inst.trim()) {
        institutionStats[inst] = (institutionStats[inst] || 0) + 1;
      }
    });
  });

  const topInstitutions = Object.entries(institutionStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  const contextSummary = `This dataset provides research insights with analysis focused on ${papers.length} papers representing current research capabilities and priorities.`;

  const institutionInsights = topInstitutions
    .slice(0, 8)
    .map(
      ([inst, count]) =>
        `- ${inst}: ${count} papers (${Math.round(
          (count / papers.length) * 100
        )}%)`
    )
    .join('\n');

  return {
    topInstitutions,
    contextSummary,
    institutionInsights,
  };
}

function selectNotablePapers(papers: ResearchPaper[]): ResearchPaper[] {
  const scoredPapers = papers.map((paper) => ({
    paper,
    score: calculateResearchScore(paper),
  }));

  return scoredPapers
    .sort((a, b) => b.score - a.score)
    .slice(0, 50)
    .map((item) => item.paper);
}

function calculateResearchScore(paper: ResearchPaper): number {
  let score = 0;

  const highImpactKeywords = [
    'breakthrough',
    'novel',
    'state-of-the-art',
    ' sota ',
  ];
  const performanceKeywords = [
    'outperform',
    'superior',
    'efficient',
    'scalable',
  ];
  const innovationKeywords = ['first-time', 'pioneering', 'unprecedented'];

  const text = (paper.title + ' ' + paper.summary).toLowerCase();

  highImpactKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 15;
    }
  });

  performanceKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 10;
    }
  });

  innovationKeywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 12;
    }
  });

  highImpactKeywords.forEach((keyword) => {
    if (paper.title.toLowerCase().includes(keyword)) {
      score += 5;
    }
  });

  paper.categories.forEach((cat) => {
    const highPriorityCategories = [
      'Artificial Intelligence',
      'Machine Learning',
      'Computer Vision',
    ];

    const mediumPriorityCategories = [
      'Natural Language Processing',
      'Robotics',
      'Neural and Evolutionary Computing',
      'Statistical Machine Learning',
    ];

    if (highPriorityCategories.includes(cat)) {
      score += 8;
    } else if (mediumPriorityCategories.includes(cat)) {
      score += 5;
    } else {
      score += 2;
    }
  });

  return score;
}

function extractResearchKeywords(abstract: string): string[] {
  if (!abstract) {
    return [];
  }

  const text = abstract.toLowerCase();
  const researchTerms = [
    'breakthrough',
    'novel approach',
    'state-of-the-art',
    'outperforms',
    'efficiency',
    'scalability',
    'robustness',
    'real-world deployment',
    'practical application',
    'performance improvement',
    'advanced capability',
    'next-generation',
    'autonomous',
    'innovative method',
    'emerging technology',
    'optimization',
    'machine learning',
  ];

  return researchTerms.filter((term) => text.includes(term)).slice(0, 3);
}

function assessInnovationLevel(title: string, summary: string): string {
  const text = (title + ' ' + summary).toLowerCase();
  const innovationIndicators = [
    {
      keywords: ['breakthrough', 'first', 'novel', 'pioneering'],
      level: 'High Innovation',
    },
    {
      keywords: ['improved', 'enhanced', 'optimized', 'efficient'],
      level: 'Incremental Innovation',
    },
    {
      keywords: ['survey', 'review', 'comparison', 'analysis'],
      level: 'Analytical/Survey',
    },
    {
      keywords: ['application', 'deployment', 'implementation'],
      level: 'Applied Research',
    },
  ];

  for (const indicator of innovationIndicators) {
    if (indicator.keywords.some((keyword) => text.includes(keyword))) {
      return indicator.level;
    }
  }

  return 'Standard Research';
}

function calculateCategoryStats(
  papers: ResearchPaper[]
): Record<string, number> {
  return papers.reduce((acc, paper) => {
    paper.categories.forEach((category) => {
      acc[category] = (acc[category] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
}

function getResearchImportanceByName(categoryName: string): string {
  const categoryEnum = Object.values(ARXIV_TO_RESEARCH_CATEGORY).find(
    (enumValue) => enumValue === categoryName
  );

  if (!categoryEnum) {
    return 'Specialized research area with potential applications across multiple domains';
  }

  const highPriorityCategories = [
    ResearchCategory.ARTIFICIAL_INTELLIGENCE,
    ResearchCategory.MACHINE_LEARNING,
    ResearchCategory.COMPUTER_VISION,
  ];

  const mediumPriorityCategories = [
    ResearchCategory.NATURAL_LANGUAGE_PROCESSING,
    ResearchCategory.ROBOTICS,
    ResearchCategory.NEURAL_COMPUTING,
    ResearchCategory.MACHINE_LEARNING,
  ];

  if (highPriorityCategories.includes(categoryEnum)) {
    return 'High-priority research area with significant strategic importance';
  } else if (mediumPriorityCategories.includes(categoryEnum)) {
    return 'Important research area with notable applications';
  } else {
    return 'Specialized research area with focused applications';
  }
}

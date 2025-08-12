import { z } from 'zod';

export enum ResearchCategory {
  ALL = 'All Categories',
  ARTIFICIAL_INTELLIGENCE = 'Artificial Intelligence',
  AUDIO_SPEECH = 'Audio/Speech',
  COMPUTER_VISION = 'Computer Vision',
  DATABASES = 'Databases',
  ETHICS_SAFETY = 'Ethics & Safety',
  INFORMATION_RETRIEVAL = 'Information Retrieval',
  MACHINE_LEARNING = 'Machine Learning',
  MULTI_AGENT_SYSTEMS = 'Multiagent Systems',
  NATURAL_LANGUAGE_PROCESSING = 'Natural Language Processing',
  NEURAL_COMPUTING = 'Neural and Evolutionary Computing',
  OPTIMIZATION = 'Optimization and Control',
  ROBOTICS = 'Robotics',
  SOFTWARE_ENGINEERING = 'Software Engineering',
  STAT_MACHINE_LEARNING = 'Statistical Machine Learning',
}

/**
 * Mapping of ArXiv category codes to human-readable category names
 */
export const ARXIV_TO_RESEARCH_CATEGORY: Record<string, ResearchCategory> = {
  'all': ResearchCategory.ALL,
  'cs.AI': ResearchCategory.ARTIFICIAL_INTELLIGENCE,
  'cs.SD': ResearchCategory.AUDIO_SPEECH,
  'cs.CV': ResearchCategory.COMPUTER_VISION,
  'cs.DB': ResearchCategory.DATABASES,
  'cs.CY': ResearchCategory.ETHICS_SAFETY,
  'cs.IR': ResearchCategory.INFORMATION_RETRIEVAL,
  'cs.LG': ResearchCategory.MACHINE_LEARNING,
  'cs.MA': ResearchCategory.MULTI_AGENT_SYSTEMS,
  'cs.CL': ResearchCategory.NATURAL_LANGUAGE_PROCESSING,
  'cs.NE': ResearchCategory.NEURAL_COMPUTING,
  'math.OC': ResearchCategory.OPTIMIZATION,
  'cs.RO': ResearchCategory.ROBOTICS,
  'cs.SE': ResearchCategory.SOFTWARE_ENGINEERING,
  'stat.ML': ResearchCategory.STAT_MACHINE_LEARNING,
  // Add any other ArXiv categories as needed
};

export const getCategoryLabel = (category: ResearchCategory): string => {
  if (category === ResearchCategory.ALL) {
    return 'All Categories';
  }
  return category;
};

export const RESEARCH_CATEGORIES = Object.keys(ARXIV_TO_RESEARCH_CATEGORY).map(key => ({
  value: key,
  label: ARXIV_TO_RESEARCH_CATEGORY[key],
}));

export const researchFormSchema = z.object({
  model: z.string().min(1, 'Model selection is required'),
  dateRange: z.string().min(1, 'Date range is required'),
  categories: z
    .array(z.string())
    .min(1, { message: 'Please select at least one category' }),
  institutions: z.string().min(1, 'At least one institution is required'),
});

export type ResearchFormValues = z.infer<typeof researchFormSchema>;

export interface ResponsePaper {
  id: string;
  updated: string;
  published: string;
  title: string;
  summary: string;
  author: Array<{
    name: string;
    'arxiv:affiliation'?: {
      '#text': string;
    }
  }>
  category: Array<{
    '_term': string;
  }>
}

export interface FilteredResponsePaper extends ResponsePaper {
  institutions: string[];
}

export type ApiResponse = {
  feed: {
    entry: ResponsePaper[];
    'opensearch:totalResults': {
      '#text': number;
    };
    'opensearch:startIndex': {
      '#text': number;
    };
  };
}

export type ResearchPaper = {
  id: string;
  updated: string;
  published: string;
  title: string;
  summary: string;
  authors: string[];
  institutions: string[];
  categories: string[];
}

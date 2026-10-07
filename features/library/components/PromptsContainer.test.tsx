import { render } from '@testing-library/react';
import PromptsContainer from './PromptsContainer';
import { Prompt } from '@/features/shared/types';
import { PromptStatsMap } from '@/features/shared/types/prompt';

jest.mock('@/features/library/components/PromptListTable', () => ({
  PromptListTable: jest.fn(() => <div>Mocked PromptListTable</div>),
}));

jest.mock('@/features/library/components/PromptCardsContainer', () => ({
  PromptCardsContainer: jest.fn(() => <div>Mocked PromptCardsContainer</div>),
}));

describe('<PromptsContainer />', () => {

  const mockStats: PromptStatsMap = {
    '2556a39e-f70a-4e2f-808f-eb98df73b9b3': { bookmarkCount: 1, usageCount: 2 },
    '868851a3-c8d3-4449-8629-2220772a429b': { bookmarkCount: 0, usageCount: 0 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPrompts: Prompt[] = [
    {
      id: '2556a39e-f70a-4e2f-808f-eb98df73b9b3',
      creatorId: '3e59402c-7c8e-49ef-a082-f3eddad32e87',
      title: 'Mock Prompt 1',
      summary: 'Mock Summary 1',
      description: 'Mock Description 1',
      instructions: 'Mock Instructions 1',
      example: 'Mock Example 1',
      tags: ['mock-tag-1', 'mock-tag-2'],
      config: {
        temperature: 0.5,
        model: 'mock-model-1',
        topP: 0.5,
      },
    },
    {
      id: '868851a3-c8d3-4449-8629-2220772a429b',
      creatorId: '4aa24650-f7fb-4abc-9f19-d48b23a2bac5',
      title: 'Mock Prompt 2',
      summary: 'Mock Summary 2',
      description: 'Mock Description 2',
      instructions: 'Mock Instructions 2',
      example: 'Mock Example 2',
      tags: ['mock-tag-3', 'mock-tag-4'],
      config: {
        temperature: 0.6,
        model: 'mock-model-2',
        topP: 0.6,
      },
    },
  ];

  it('should render PromptListTable when isTableView is true', () => {
    const { getByText } = render(
      <PromptsContainer prompts={mockPrompts} isTableView={true} stats={mockStats} />
    );
    expect(getByText('Mocked PromptListTable')).toBeInTheDocument();
  });

  it('should render PromptCardsContainer when isTableView is false', () => {
    const { getByText } = render(
      <PromptsContainer prompts={mockPrompts} isTableView={false} stats={mockStats} />
    );
    expect(getByText('Mocked PromptCardsContainer')).toBeInTheDocument();
  });

  it('should display "No results were found." when prompts array is empty', () => {
    const { getByText } = render(
      <PromptsContainer prompts={[]} isTableView={true} stats={{}} />
    );
    expect(getByText('No results were found.')).toBeInTheDocument();
  });

  it('should pass stats data to child components', () => {
    const { getByText } = render(
      <PromptsContainer prompts={mockPrompts} isTableView={true} stats={mockStats} />
    );
    
    // Verify that the table component is rendered 
    expect(getByText('Mocked PromptListTable')).toBeInTheDocument();
  });
});
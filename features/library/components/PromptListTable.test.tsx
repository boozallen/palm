import { render, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import { PromptListTable } from './PromptListTable';
import { Prompt, PromptStatsMap } from '@/features/shared/types';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('./PromptActions', () => ({
  __esModule: true,
  default: jest.fn(() => <div>Mocked PromptActions</div>),
}));

jest.mock('./PromptStatsBadges', () => ({
  __esModule: true,
  default: jest.fn(({ stats }) => (
    <div data-testid='stats-badges'>
      {stats.bookmarkCount} bookmarks, {stats.usageCount} uses
    </div>
  )),
}));

jest.mock('@/components/elements/TagBadges', () => ({
  __esModule: true,
  default: jest.fn(({ tags }) => <div data-testid='tag-badges'>{tags.join(', ')}</div>),
}));

jest.mock('@/features/shared/utils', () => ({
  generatePromptUrl: jest.fn((title, id) => `/prompts/${title}/${id}`),
}));

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn().mockReturnValue({ mutate: jest.fn() }),
}));

describe('<PromptListTable />', () => {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  const mockPrompts: Prompt[] = [
    {
      id: 'prompt-1',
      creatorId: 'user-1',
      title: 'Test Prompt 1',
      summary: 'Test Summary 1',
      description: 'Test Description 1',
      instructions: 'Test Instructions 1',
      example: 'Test Example 1',
      tags: ['tag1', 'tag2'],
      config: {
        temperature: 0.5,
        model: 'test-model',
        topP: 0.5,
      },
    },
    {
      id: 'prompt-2',
      creatorId: 'user-2',
      title: 'Test Prompt 2',
      summary: 'Test Summary 2',
      description: 'Test Description 2',
      instructions: 'Test Instructions 2',
      example: 'Test Example 2',
      tags: ['tag3'],
      config: {
        temperature: 0.7,
        model: 'test-model-2',
        topP: 0.3,
      },
    },
  ];

  const mockStats: PromptStatsMap = {
    'prompt-1': { bookmarkCount: 5, usageCount: 10 },
    'prompt-2': { bookmarkCount: 2, usageCount: 3 },
  };

  it('should render table with prompts', () => {
    const { getByText } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    expect(getByText('Test Prompt 1')).toBeInTheDocument();
    expect(getByText('Test Prompt 2')).toBeInTheDocument();
    expect(getByText('Test Summary 1')).toBeInTheDocument();
    expect(getByText('Test Summary 2')).toBeInTheDocument();
  });

  it('should render stats badges when stats are available', () => {
    const { getAllByTestId } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    const statsBadges = getAllByTestId('stats-badges');
    expect(statsBadges).toHaveLength(2);
    expect(statsBadges[0]).toHaveTextContent('5 bookmarks, 10 uses');
    expect(statsBadges[1]).toHaveTextContent('2 bookmarks, 3 uses');
  });

  it('should not render stats badges when stats are not available for a prompt', () => {
    const statsWithMissing: PromptStatsMap = {
      'prompt-1': { bookmarkCount: 5, usageCount: 10 },
    };

    const { getAllByTestId } = render(
      <PromptListTable prompts={mockPrompts} stats={statsWithMissing} />
    );

    const statsBadges = getAllByTestId('stats-badges');
    expect(statsBadges).toHaveLength(1);
    expect(statsBadges[0]).toHaveTextContent('5 bookmarks, 10 uses');
  });

  it('should render tag badges for each prompt', () => {
    const { getAllByTestId } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    const tagBadges = getAllByTestId('tag-badges');
    expect(tagBadges).toHaveLength(2);
    expect(tagBadges[0]).toHaveTextContent('tag1, tag2');
    expect(tagBadges[1]).toHaveTextContent('tag3');
  });

  it('should navigate to prompt when anchor is clicked', () => {
    const { getByText } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    const promptLink = getByText('Test Prompt 1');
    promptLink.click();

    expect(mockPush).toHaveBeenCalledWith('/prompts/Test Prompt 1/prompt-1');
  });

  it('should navigate to prompt when Enter key is pressed on anchor', () => {
    const { getByText } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    const promptLink = getByText('Test Prompt 1');
    
    // Simulate Enter key press using fireEvent
    fireEvent.keyDown(promptLink, { key: 'Enter' });

    expect(mockPush).toHaveBeenCalledWith('/prompts/Test Prompt 1/prompt-1');
  });

  it('should render empty table when no prompts provided', () => {
    const { container } = render(
      <PromptListTable prompts={[]} stats={{}} />
    );

    const tbody = container.querySelector('tbody');
    expect(tbody?.children).toHaveLength(0);
  });

  it('should render table headers correctly', () => {
    const { getByText } = render(
      <PromptListTable prompts={mockPrompts} stats={mockStats} />
    );

    expect(getByText('Prompt')).toBeInTheDocument();
    expect(getByText('Prompt description')).toBeInTheDocument();
    expect(getByText('Tag(s)')).toBeInTheDocument();
    expect(getByText('Stats')).toBeInTheDocument();
  });
});

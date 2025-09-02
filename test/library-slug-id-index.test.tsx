import { render } from '@testing-library/react';
import { useRouter } from 'next/router';

import { useGetPrompt } from '@/features/library/api/get-prompt';
import { Prompt } from '@/features/shared/types';
import PromptHandler from '@/pages/library/[slug]/[promptId]';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/library/api/get-prompt');
jest.mock('@/features/library/components/PromptDetailsContainer', () => {
  return jest.fn(() => <div>PromptDetailsContainer</div>);
});

const mockPrompt: Prompt = {
  id: '51963f40-a699-46ec-85fe-efa165fbf0ea',
  creatorId: null,
  title: 'Test Prompt',
  summary: 'Test summary',
  description: 'Test description',
  instructions: 'Test',
  example: 'Test example',
  tags: ['test', 'tag'],
  config: {
    randomness: 0.5,
    model: 'gpt-4o',
    repetitiveness: 0.5,
  },
};

const mockGetPrompt = (
  data: { prompt: Prompt } | null = { prompt: mockPrompt },
  isPending: boolean = false,
  error: Error | null = null
) => {
  (useGetPrompt as jest.Mock).mockReturnValue({
    data,
    isPending,
    error,
  });
};

describe('pages/library/[slug]/[promptId]/index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPrompt();

    (useRouter as jest.Mock).mockReturnValue({
      query: {
        promptId: mockPrompt.id,
      },
    });
  });

  it('calls useGetPrompt with correct promptId', () => {
    render(<PromptHandler />);
    expect(useGetPrompt).toHaveBeenCalledWith({
      promptId: mockPrompt.id,
    });
  });

  it('renders loading text if prompt is loading', () => {
    mockGetPrompt(undefined, true);
    const { getByText } = render(<PromptHandler />);
    expect(getByText('Loading...')).toBeInTheDocument();
  });

  it('renders "Not found" if prompt is null', () => {
    mockGetPrompt(null);
    const { getByText } = render(<PromptHandler />);
    expect(getByText('Not found')).toBeInTheDocument();
  });

  it('renders prompt details interface if not prompt is available', () => {
    const { getByText } = render(<PromptHandler />);
    expect(getByText('PromptDetailsContainer')).toBeInTheDocument();
  });
});


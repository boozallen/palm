import {
  render,
  screen,
  fireEvent,
  act,
} from '@testing-library/react';

import Agent from './Agent';
import { useStartResearchJob } from '@/features/ai-agents/api/radar/start-research-job';
import { useGetResearchJobStatus } from '@/features/ai-agents/api/radar/get-research-job-status';
import { useGetResearchJobResults } from '@/features/ai-agents/api/radar/get-research-job-results';

jest.mock('@/features/ai-agents/api/radar/start-research-job');
jest.mock('@/features/ai-agents/api/radar/get-research-job-status');
jest.mock('@/features/ai-agents/api/radar/get-research-job-results');

jest.mock('./Form', () => {
  const actual = jest.requireActual('./Form');
  return {
    ...actual,
    __esModule: true,
    default: jest.fn(({ onSubmit }) => (
      <button
        data-testid='research-form-button'
        onClick={() =>
          onSubmit({
            model: 'model-id',
            dateRange: 'last-30-days',
            categories: ['AI', 'Computer Vision', 'NLP'],
            institutions: 'Harvard, Stanford',
          })
        }
      >
        Research Form
      </button>
    )),
    transformFormValues: jest.fn().mockImplementation((values) => ({
      dateStart: '2025-04-19',
      dateEnd: '2025-05-19',
      categories: ['AI', 'Computer Vision', 'NLP'],
      institutions: ['Harvard', 'Stanford'],
      model: values.model,
    })),
  };
});

import { transformFormValues } from './Form';

jest.mock('./SearchResults', () => {
  return jest.fn(({ totalResults, totalInstitutions, categories }) => (
    <div data-testid='search-results'>
      <div data-testid='papers-found'>{totalResults} papers found</div>
      <div data-testid='institutions-count'>
        {totalInstitutions} institutions
      </div>
      <div data-testid='categories-count'>
        {Object.keys(categories).length} categories
      </div>
    </div>
  ));
});

jest.mock('./LlmAnalysis', () => {
  return jest.fn(({ analysis }) => (
    <div data-testid='llm-analysis'>
      <div data-testid='analysis-content'>{analysis.substring(0, 50)}...</div>
    </div>
  ));
});

jest.mock('./Accordion', () => {
  return jest.fn(({ papers }) => (
    <div data-testid='research-papers'>
      <div data-testid='papers-count'>{papers ? papers.length : 0} papers</div>
    </div>
  ));
});

describe('Research Agent', () => {
  const mutateAsyncMock = jest.fn();
  const refetchMock = jest.fn();
  const refetchResultsMock = jest.fn();
  const mockId = 'd15a9cee-e240-4ba8-8f81-0f923c51aebc';

  beforeEach(() => {
    mutateAsyncMock.mockClear();
    refetchMock.mockClear();
    jest.useFakeTimers();

    (useStartResearchJob as jest.Mock).mockReturnValue({
      mutateAsync: mutateAsyncMock,
    });

    refetchMock.mockResolvedValue({ data: null });
    (useGetResearchJobStatus as jest.Mock).mockReturnValue({
      refetch: refetchMock,
    });

    refetchResultsMock.mockResolvedValue({ data: null });
    (useGetResearchJobResults as jest.Mock).mockReturnValue({
      refetch: refetchResultsMock,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the research form', () => {
    render(<Agent id={mockId} />);
    const formButton = screen.getByTestId('research-form-button');
    expect(formButton).toBeInTheDocument();
  });

  it('shows processing state when job is running', async () => {
    mutateAsyncMock.mockResolvedValue({ jobId: 'test-job-id-123' });
    render(<Agent id={mockId} />);
    const formButton = screen.getByTestId('research-form-button');

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(
      screen.getByText('Processing research papers...')
    ).toBeInTheDocument();
    expect(
      screen.getByText('AI analysis will be generated after search completes')
    ).toBeInTheDocument();
  });

  it('transforms form values correctly when submitted', async () => {
    render(<Agent id={mockId} />);
    const formButton = screen.getByTestId('research-form-button');

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(transformFormValues).toHaveBeenCalledWith({
      model: 'model-id',
      dateRange: 'last-30-days',
      categories: ['AI', 'Computer Vision', 'NLP'],
      institutions: 'Harvard, Stanford',
    });
  });

  it('calls startJob with transformed values on form submission', async () => {
    mutateAsyncMock.mockResolvedValue({ jobId: 'test-job-id-123' });
    render(<Agent id={mockId} />);
    const formButton = screen.getByTestId('research-form-button');

    await act(async () => {
      fireEvent.click(formButton);
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith({
      agentId: mockId,
      dateStart: '2025-04-19',
      dateEnd: '2025-05-19',
      categories: ['AI', 'Computer Vision', 'NLP'],
      institutions: ['Harvard', 'Stanford'],
      model: 'model-id',
    });
  });
});

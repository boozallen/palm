import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import Agent from './Agent';
import { useSwear } from '@/features/ai-agents/hooks/swear/useSwear';

jest.mock('@mantine/notifications');
jest.mock('@/features/ai-agents/hooks/swear/useSwear');
jest.mock('./Form', () => {
  return function MockForm({ onSubmit, isLoading }: { onSubmit: (values: { file: File; model: string }) => void; isLoading: boolean }) {
    const handleClick = () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      onSubmit({ file: mockFile, model: 'gpt-4' });
    };

    return (
      <div data-testid='mock-form'>
        <button type='button' onClick={handleClick} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Submit'}
        </button>
      </div>
    );
  };
});

describe('Agent', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockAnalyzeDocument = jest.fn();
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useSwear as jest.Mock).mockReturnValue({
      analyzeDocument: mockAnalyzeDocument,
      reset: mockReset,
      isProcessing: false,
      progress: '',
      results: null,
      error: null,
    });
  });

  it('should render the component', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Search Warrant Analysis')).toBeInTheDocument();
  });

  it('should render the upload prompt when no analysis', () => {
    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Upload a search warrant to get started')).toBeInTheDocument();
  });

  it('should show loading state when processing', () => {
    (useSwear as jest.Mock).mockReturnValue({
      analyzeDocument: mockAnalyzeDocument,
      reset: mockReset,
      isProcessing: true,
      progress: 'Analyzing warrant...',
      results: null,
      error: null,
    });

    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should call reset when form is submitted', async () => {
    mockAnalyzeDocument.mockResolvedValue({ jobId: 'job-123' });

    render(<Agent id={mockAgentId} />);

    const submitButton = screen.getByRole('button', { name: 'Submit' });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    // Wait for reset to be called
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalled();
    });
  });

  it('should show error notification when analyzeDocument fails', async () => {
    mockAnalyzeDocument.mockRejectedValue(new Error('Analysis failed'));

    render(<Agent id={mockAgentId} />);

    const submitButton = screen.getByRole('button', { name: 'Submit' });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Error',
        color: 'red',
      })
    );
  });

  it('should display analysis results when available', () => {
    const mockResults = {
      analysis: [
        {
          category: 'Preliminary Information',
          requirement: 'Test requirement',
          status: 'PASS',
          confidence: 'HIGH',
          evidence: 'Test evidence',
        },
      ],
      filename: 'test-warrant.pdf',
    };

    (useSwear as jest.Mock).mockReturnValue({
      analyzeDocument: mockAnalyzeDocument,
      reset: mockReset,
      isProcessing: false,
      progress: '',
      results: mockResults,
      error: null,
    });

    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByText('test-warrant.pdf')).toBeInTheDocument();
  });

  it('should display summary stats', () => {
    const mockResults = {
      analysis: [
        { category: 'Cat1', requirement: 'Req1', status: 'PASS', confidence: 'HIGH', evidence: 'Ev1' },
        { category: 'Cat1', requirement: 'Req2', status: 'FAIL', confidence: 'MEDIUM', evidence: 'Ev2' },
        { category: 'Cat1', requirement: 'Req3', status: 'PARTIAL', confidence: 'LOW', evidence: 'Ev3' },
        { category: 'Cat1', requirement: 'Req4', status: 'N/A', confidence: 'HIGH', evidence: 'Ev4' },
      ],
      filename: 'test.pdf',
    };

    (useSwear as jest.Mock).mockReturnValue({
      analyzeDocument: mockAnalyzeDocument,
      reset: mockReset,
      isProcessing: false,
      progress: '',
      results: mockResults,
      error: null,
    });

    render(<Agent id={mockAgentId} />);

    expect(screen.getByText('Total checklist items: 4')).toBeInTheDocument();
    expect(screen.getByText('Pass: 1')).toBeInTheDocument();
    expect(screen.getByText('Fail: 1')).toBeInTheDocument();
    expect(screen.getByText('Partial: 1')).toBeInTheDocument();
    expect(screen.getByText('N/A: 1')).toBeInTheDocument();
  });

  it('should show upload prompt when analysis is null (parsing failed on backend)', () => {
    const mockResults = {
      analysis: null,
      filename: 'test.pdf',
    };

    (useSwear as jest.Mock).mockReturnValue({
      analyzeDocument: mockAnalyzeDocument,
      reset: mockReset,
      isProcessing: false,
      progress: '',
      results: mockResults,
      error: null,
    });

    render(<Agent id={mockAgentId} />);

    // When analysis is null, we show the upload prompt (no results to display)
    expect(screen.getByText('Upload a search warrant to get started')).toBeInTheDocument();
  });
});

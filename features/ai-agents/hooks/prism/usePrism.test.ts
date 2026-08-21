import { act, renderHook, waitFor } from '@testing-library/react';

import { usePrism } from './usePrism';
import useAnalyzeProposal from '@/features/ai-agents/api/prism/analyze-proposal';
import useGetPrismUploadUrls from '@/features/ai-agents/api/prism/get-prism-upload-urls';
import usePrismStatus from '@/features/ai-agents/api/prism/get-prism-status';
import usePrismResults from '@/features/ai-agents/api/prism/get-prism-results';
import useActivePrismJob from '@/features/ai-agents/api/prism/get-active-prism-job';

jest.mock('@/features/ai-agents/api/prism/analyze-proposal');
jest.mock('@/features/ai-agents/api/prism/get-prism-upload-urls');
jest.mock('@/features/ai-agents/api/prism/get-prism-status');
jest.mock('@/features/ai-agents/api/prism/get-prism-results');
jest.mock('@/features/ai-agents/api/prism/get-active-prism-job');

const mockUploadUrls = {
  requirementsFileKey: 'uploads/requirements.xlsx',
  requirementsPresignedUrl: 'https://s3.example.com/requirements?sig=abc',
  proposalFileKey: 'uploads/proposal.pdf',
  proposalPresignedUrl: 'https://s3.example.com/proposal?sig=def',
  documentUploadProviderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};

const makeFile = (name: string, type: string): File => new File(['content'], name, { type });

// Returns a new XHR instance per construction so concurrent uploads each get their own handler
const makeXhrInstance = () => {
  let loadHandler: (() => void) | null = null;
  return {
    timeout: 0,
    status: 200,
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn().mockImplementation(() => {
      loadHandler?.();
    }),
    addEventListener: jest.fn().mockImplementation((event: string, handler: () => void) => {
      if (event === 'load') {
        loadHandler = handler;
      }
    }),
  };
};

describe('usePrism', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockJobId = 'job-123';

  const mockGetUploadUrls = jest.fn();
  const mockAnalyzeProposal = jest.fn();

  const mockParams = {
    requirementsFile: makeFile('requirements.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    proposalFile: makeFile('proposal.pdf', 'application/pdf'),
    modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (global as any).XMLHttpRequest = jest.fn().mockImplementation(makeXhrInstance);

    (useGetPrismUploadUrls as jest.Mock).mockReturnValue({
      mutateAsync: mockGetUploadUrls,
      isPending: false,
    });

    (useAnalyzeProposal as jest.Mock).mockReturnValue({
      mutateAsync: mockAnalyzeProposal,
      isPending: false,
    });

    (usePrismStatus as jest.Mock).mockReturnValue({ data: null });
    (usePrismResults as jest.Mock).mockReturnValue({ data: null });
    (useActivePrismJob as jest.Mock).mockReturnValue({ data: { job: null } });

    mockGetUploadUrls.mockResolvedValue(mockUploadUrls);
    mockAnalyzeProposal.mockResolvedValue({ jobId: mockJobId, message: 'Job queued' });
  });

  describe('Initial state', () => {
    it('has idle job status', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.jobStatus).toBe('idle');
    });

    it('is not processing', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.isProcessing).toBe(false);
    });

    it('has empty progress', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.progress).toBe('');
    });

    it('has null results', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.results).toBeNull();
    });

    it('has null error', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.error).toBeNull();
    });

    it('has null completedJobId', () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.completedJobId).toBeNull();
    });
  });

  describe('analyzeDocument', () => {
    it('calls getUploadUrls with the agent id, file names, and proposal content type', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      expect(mockGetUploadUrls).toHaveBeenCalledWith({
        agentId: mockAgentId,
        requirementsFileName: 'requirements.xlsx',
        proposalFileName: 'proposal.pdf',
        proposalContentType: 'application/pdf',
      });
    });

    it('uploads both files to S3 using the presigned URLs', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      const xhrCalls = (global as any).XMLHttpRequest.mock.results.map(
        (r: { value: ReturnType<typeof makeXhrInstance> }) => r.value,
      );

      const openCalls = xhrCalls.flatMap((xhr: ReturnType<typeof makeXhrInstance>) =>
        (xhr.open as jest.Mock).mock.calls,
      );

      expect(openCalls).toContainEqual(['PUT', mockUploadUrls.requirementsPresignedUrl]);
      expect(openCalls).toContainEqual(['PUT', mockUploadUrls.proposalPresignedUrl]);
    });

    it('calls analyzeProposal with the file keys returned by getUploadUrls', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      expect(mockAnalyzeProposal).toHaveBeenCalledWith({
        agentId: mockAgentId,
        requirementsFileKey: mockUploadUrls.requirementsFileKey,
        requirementsFileName: 'requirements.xlsx',
        proposalFileKey: mockUploadUrls.proposalFileKey,
        proposalFileName: 'proposal.pdf',
        proposalContentType: 'application/pdf',
        documentUploadProviderId: mockUploadUrls.documentUploadProviderId,
        modelId: mockParams.modelId,
      });
    });

    it('sets jobStatus to processing', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      expect(result.current.jobStatus).toBe('processing');
    });

    it('is still processing after the job is queued because polling has started', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      expect(result.current.isProcessing).toBe(true);
    });
  });

  describe('Status polling', () => {
    it('updates progress from status data', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'processing', progress: 'Embedding 47 proposal sections...' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.progress).toBe('Embedding 47 proposal sections...');
      });
    });

    it('sets jobStatus to completed when the worker reports completion', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'completed', progress: 'Analysis complete!' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.jobStatus).toBe('completed');
      });
    });

    it('calls onComplete when the worker reports completion', async () => {
      const onComplete = jest.fn();
      const { result, rerender } = renderHook(() => usePrism(mockAgentId, { onComplete }));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'completed', progress: 'Analysis complete!' },
      });

      rerender();

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalled();
      });
    });

    it('sets completedJobId so results can be fetched', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'completed', progress: 'Analysis complete!' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.completedJobId).toBe(mockJobId);
      });
    });

    it('sets jobStatus to error when the worker reports an error', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'error', error: 'Could not parse proposal' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.jobStatus).toBe('error');
        expect(result.current.error).toBe('Could not parse proposal');
      });
    });

    it('calls onError when the worker reports an error', async () => {
      const onError = jest.fn();
      const { result, rerender } = renderHook(() => usePrism(mockAgentId, { onError }));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'error', error: 'Could not parse proposal' },
      });

      rerender();

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('Could not parse proposal');
      });
    });

    it('uses a default error message when the worker reports no error detail', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'error' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.error).toBe('An error occurred during analysis');
      });
    });

    it('stops processing after an error', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'error', error: 'Something went wrong' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.isProcessing).toBe(false);
      });
    });
  });

  describe('Results', () => {
    it('returns results from usePrismResults once the job completes', async () => {
      const mockResults = [
        {
          id: 'r1',
          jobId: mockJobId,
          category: null,
          requirement: 'The system shall support 1,000 concurrent users.',
          complianceStatus: 'YES',
          reasoning: 'The proposal clearly addresses this.',
          citations: null,
          sortOrder: 0,
        },
      ];

      (usePrismResults as jest.Mock).mockReturnValue({ data: { results: mockResults } });

      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'completed', progress: 'Analysis complete!' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults);
      });
    });

    it('returns null results while the job is still in progress', async () => {
      const { result } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      expect(result.current.results).toBeNull();
    });
  });

  describe('reset', () => {
    it('resets all state back to idle', async () => {
      const { result, rerender } = renderHook(() => usePrism(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockParams);
      });

      (usePrismStatus as jest.Mock).mockReturnValue({
        data: { status: 'completed', progress: 'Analysis complete!' },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.jobStatus).toBe('completed');
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.jobStatus).toBe('idle');
      expect(result.current.progress).toBe('');
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.completedJobId).toBeNull();
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('isProcessing', () => {
    it('is true while getUploadUrls is pending', () => {
      (useGetPrismUploadUrls as jest.Mock).mockReturnValue({
        mutateAsync: mockGetUploadUrls,
        isPending: true,
      });

      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.isProcessing).toBe(true);
    });

    it('is true while analyzeProposal is pending', () => {
      (useAnalyzeProposal as jest.Mock).mockReturnValue({
        mutateAsync: mockAnalyzeProposal,
        isPending: true,
      });

      const { result } = renderHook(() => usePrism(mockAgentId));

      expect(result.current.isProcessing).toBe(true);
    });
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';

import { useSwear } from './useSwear';
import useAnalyzeWarrant, { useSwearStatus } from '@/features/ai-agents/api/swear/analyze-warrant';

jest.mock('@/features/ai-agents/api/swear/analyze-warrant');

describe('useSwear', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockJobId = 'job-123';

  const mockAnalyzeWarrant = jest.fn();

  const mockAnalyzeWarrantParams = {
    fileContent: 'base64content',
    fileName: 'test-warrant.pdf',
    contentType: 'application/pdf',
    modelId: 'gpt-4',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useAnalyzeWarrant as jest.Mock).mockReturnValue({
      mutateAsync: mockAnalyzeWarrant,
      isPending: false,
    });

    (useSwearStatus as jest.Mock).mockReturnValue({
      data: null,
    });
  });

  describe('Initial state', () => {
    it('should have idle job status initially', () => {
      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.jobStatus).toBe('idle');
    });

    it('should not be processing initially', () => {
      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.isProcessing).toBe(false);
    });

    it('should have empty progress initially', () => {
      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.progress).toBe('');
    });

    it('should have null results initially', () => {
      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.results).toBeNull();
    });

    it('should have null error initially', () => {
      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.error).toBeNull();
    });
  });

  describe('analyzeDocument', () => {
    it('should call analyzeWarrant with correct params', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      expect(mockAnalyzeWarrant).toHaveBeenCalledWith({
        agentId: mockAgentId,
        fileContent: mockAnalyzeWarrantParams.fileContent,
        fileName: mockAnalyzeWarrantParams.fileName,
        contentType: mockAnalyzeWarrantParams.contentType,
        modelId: mockAnalyzeWarrantParams.modelId,
      });
    });

    it('should set job status to processing', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      expect(result.current.jobStatus).toBe('processing');
    });

    it('should set progress message', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      expect(result.current.progress).toBe('Processing file...');
    });

    it('should pass a selected userGroupId through to analyzeWarrant', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument({ ...mockAnalyzeWarrantParams, userGroupId: 'group-1' });
      });

      expect(mockAnalyzeWarrant).toHaveBeenCalledWith({
        agentId: mockAgentId,
        fileContent: mockAnalyzeWarrantParams.fileContent,
        fileName: mockAnalyzeWarrantParams.fileName,
        contentType: mockAnalyzeWarrantParams.contentType,
        modelId: mockAnalyzeWarrantParams.modelId,
        userGroupId: 'group-1',
      });
    });

    it('should handle submission error', async () => {
      const mockError = new Error('Submission failed');
      mockAnalyzeWarrant.mockRejectedValue(mockError);

      const onError = jest.fn();
      const { result } = renderHook(() => useSwear(mockAgentId, { onError }));

      await act(async () => {
        try {
          await result.current.analyzeDocument(mockAnalyzeWarrantParams);
        } catch {
          // Expected error
        }
      });

      expect(result.current.jobStatus).toBe('error');
      expect(result.current.error).toBe('Submission failed');
      expect(onError).toHaveBeenCalledWith('Submission failed');
    });
  });

  describe('Status polling', () => {
    it('should update progress from status data', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result, rerender } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      // Simulate status update
      (useSwearStatus as jest.Mock).mockReturnValue({
        data: {
          status: 'processing',
          progress: 'Analyzing warrant...',
        },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.progress).toBe('Analyzing warrant...');
      });
    });

    it('should handle completed status with results', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });
      const onComplete = jest.fn();

      const mockResults = {
        analysis: 'Analysis content',
        filename: 'test-warrant.pdf',
      };

      const { result, rerender } = renderHook(() =>
        useSwear(mockAgentId, { onComplete })
      );

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      // Simulate completed status
      (useSwearStatus as jest.Mock).mockReturnValue({
        data: {
          status: 'completed',
          progress: 'Analysis complete!',
          results: mockResults,
        },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.jobStatus).toBe('completed');
        expect(result.current.results).toEqual(mockResults);
        expect(onComplete).toHaveBeenCalledWith(mockResults);
      });
    });

    it('should handle error status', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });
      const onError = jest.fn();

      const { result, rerender } = renderHook(() =>
        useSwear(mockAgentId, { onError })
      );

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      // Simulate error status
      (useSwearStatus as jest.Mock).mockReturnValue({
        data: {
          status: 'error',
          error: 'Analysis failed',
        },
      });

      rerender();

      await waitFor(() => {
        expect(result.current.jobStatus).toBe('error');
        expect(result.current.error).toBe('Analysis failed');
        expect(onError).toHaveBeenCalledWith('Analysis failed');
      });
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      mockAnalyzeWarrant.mockResolvedValue({ jobId: mockJobId });

      const { result } = renderHook(() => useSwear(mockAgentId));

      await act(async () => {
        await result.current.analyzeDocument(mockAnalyzeWarrantParams);
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.jobStatus).toBe('idle');
      expect(result.current.progress).toBe('');
      expect(result.current.results).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('isProcessing', () => {
    it('should be true when submitting', () => {
      (useAnalyzeWarrant as jest.Mock).mockReturnValue({
        mutateAsync: mockAnalyzeWarrant,
        isPending: true,
      });

      const { result } = renderHook(() => useSwear(mockAgentId));

      expect(result.current.isProcessing).toBe(true);
    });
  });
});

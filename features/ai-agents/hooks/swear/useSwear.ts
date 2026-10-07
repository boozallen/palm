/**
 * Hook: useSwear
 *
 * React hook for search warrant analysis workflow. Handles queuing the analysis job
 * and polling for completion status. Returns analysis results when processing completes.
 *
 * Used by: features/ai-agents/components/swear/Agent.tsx
 */

import { useState, useEffect, useCallback } from 'react';

import useAnalyzeWarrant, { useSwearStatus } from '@/features/ai-agents/api/swear/analyze-warrant';
import type { JobStatusType } from '@/features/ai-agents/utils/shared/types';
import type { AnalysisItem } from '@/features/ai-agents/types/swear/analysisItem';

type HookJobStatus = JobStatusType | 'idle';

type AnalyzeWarrantParams = {
  fileContent: string;
  fileName: string;
  contentType: string;
  modelId: string;
  userGroupId?: string;
};

type AnalysisResults = {
  analysis: AnalysisItem[] | null;
  filename: string;
};

type UseSwearOptions = {
  onComplete?: (results: AnalysisResults) => void;
  onError?: (error: string) => void;
};

export function useSwear(agentId: string, options?: UseSwearOptions) {
  const { mutateAsync: analyzeWarrant, isPending: isSubmitting } = useAnalyzeWarrant();
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [jobStatus, setJobStatus] = useState<HookJobStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: statusData } = useSwearStatus(agentId, jobId);

  // Handle status changes from polling
  useEffect(() => {
    if (!statusData || !isPolling) {
      return;
    }

    // Update progress message
    if (statusData.progress) {
      setProgress(statusData.progress);
    }

    if (statusData.status === 'completed' && statusData.results) {
      setIsPolling(false);
      setJobId(null);
      setJobStatus('completed');
      setProgress('Analysis complete!');

      const analysisResults: AnalysisResults = {
        analysis: statusData.results.analysis,
        filename: statusData.results.filename,
      };

      setResults(analysisResults);
      options?.onComplete?.(analysisResults);
    } else if (statusData.status === 'error') {
      setIsPolling(false);
      setJobId(null);
      setJobStatus('error');
      setError(statusData.error || 'An error occurred during analysis');
      options?.onError?.(statusData.error || 'An error occurred during analysis');
    }
  }, [statusData, isPolling, options]);

  const analyzeDocument = useCallback(async (params: AnalyzeWarrantParams) => {
    // Reset state for new analysis
    setJobStatus('processing');
    setProgress('Processing file...');
    setResults(null);
    setError(null);

    try {
      const result = await analyzeWarrant({
        agentId,
        fileContent: params.fileContent,
        fileName: params.fileName,
        contentType: params.contentType,
        modelId: params.modelId,
        userGroupId: params.userGroupId,
      });

      if (result.jobId) {
        setJobId(result.jobId);
        setIsPolling(true);
      }

      return result;
    } catch (err) {
      setJobStatus('error');
      const errorMessage = err instanceof Error ? err.message : 'Failed to queue analysis';
      setError(errorMessage);
      options?.onError?.(errorMessage);
      throw err;
    }
  }, [agentId, analyzeWarrant, options]);

  const reset = useCallback(() => {
    setJobId(null);
    setIsPolling(false);
    setJobStatus('idle');
    setProgress('');
    setResults(null);
    setError(null);
  }, []);

  return {
    analyzeDocument,
    reset,
    isProcessing: isSubmitting || isPolling,
    jobStatus,
    progress,
    results,
    error,
  };
}

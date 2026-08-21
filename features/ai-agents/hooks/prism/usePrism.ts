/**
 * Hook: usePrism
 *
 * React hook for proposal compliance analysis workflow. Handles:
 * 1. Obtaining presigned S3 URLs for both files
 * 2. Uploading files directly to S3
 * 3. Queuing the analysis job
 * 4. Polling for status and fetching results from the database on completion
 * 5. Auto-resuming any in-progress job when the user returns to the page
 *
 * Used by: features/ai-agents/components/prism/Agent.tsx
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import useAnalyzeProposal from '@/features/ai-agents/api/prism/analyze-proposal';
import useGetPrismUploadUrls from '@/features/ai-agents/api/prism/get-prism-upload-urls';
import usePrismStatus from '@/features/ai-agents/api/prism/get-prism-status';
import usePrismResults from '@/features/ai-agents/api/prism/get-prism-results';
import useActivePrismJob from '@/features/ai-agents/api/prism/get-active-prism-job';
import type { JobStatusType } from '@/features/ai-agents/utils/shared/types';
import type { ComplianceResult } from '@/features/ai-agents/types/prism/complianceResult';

type HookJobStatus = JobStatusType | 'idle';

type AnalyzeProposalParams = {
  requirementsFile: File;
  proposalFile: File;
  modelId: string;
};

type UsePrismOptions = {
  onComplete?: () => void;
  onError?: (error: string) => void;
};

async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = 300000;

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`Upload failed for ${file.name}: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error(`Network error uploading ${file.name}`)));
    xhr.addEventListener('timeout', () => reject(new Error(`Upload timed out for ${file.name}`)));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export function usePrism(agentId: string, options?: UsePrismOptions) {
  const { mutateAsync: analyzeProposal, isPending: isSubmitting } = useAnalyzeProposal();
  const { mutateAsync: getUploadUrls, isPending: isGettingUrls } = useGetPrismUploadUrls();

  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<HookJobStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);

  // Prevent restoring an active job more than once (e.g. after user resets and submits a new job)
  const hasRestoredJob = useRef(false);

  const { data: activeJobData } = useActivePrismJob(agentId);
  const { data: statusData } = usePrismStatus(agentId, jobId);
  const { data: resultsData } = usePrismResults(agentId, completedJobId);

  // Auto-resume any in-progress job found in the DB when the page loads
  useEffect(() => {
    if (hasRestoredJob.current || !activeJobData || jobStatus !== 'idle') {
      return;
    }

    const job = activeJobData.job;
    if (!job) {
      return;
    }

    hasRestoredJob.current = true;
    setJobId(job.id);
    setIsPolling(true);
    setJobStatus('processing');
    setProgress('Resuming analysis...');
  }, [activeJobData, jobStatus]);

  useEffect(() => {
    if (!statusData || !isPolling) {
      return;
    }

    if (statusData.progress) {
      setProgress(statusData.progress);
    }

    if (statusData.status === 'completed') {
      setIsPolling(false);
      setCompletedJobId(jobId);
      setJobId(null);
      setJobStatus('completed');
      setProgress('Analysis complete!');
      options?.onComplete?.();
    } else if (statusData.status === 'error') {
      setIsPolling(false);
      setJobId(null);
      setJobStatus('error');
      setError(statusData.error || 'An error occurred during analysis');
      options?.onError?.(statusData.error || 'An error occurred during analysis');
    }
  }, [statusData, isPolling, jobId, options]);

  const analyzeDocument = useCallback(async (params: AnalyzeProposalParams) => {
    setJobStatus('processing');
    setProgress('Preparing upload...');
    setError(null);
    setCompletedJobId(null);

    // Step 1: Get presigned URLs
    const uploadUrls = await getUploadUrls({
      agentId,
      requirementsFileName: params.requirementsFile.name,
      proposalFileName: params.proposalFile.name,
      proposalContentType: params.proposalFile.type,
    });

    // Step 2: Upload both files directly to S3
    setIsUploading(true);
    setProgress('Uploading files...');

    await Promise.all([
      uploadToS3(uploadUrls.requirementsPresignedUrl, params.requirementsFile),
      uploadToS3(uploadUrls.proposalPresignedUrl, params.proposalFile),
    ]);

    setIsUploading(false);
    setProgress('Queuing analysis job...');

    // Step 3: Trigger analysis with file keys
    const result = await analyzeProposal({
      agentId,
      requirementsFileKey: uploadUrls.requirementsFileKey,
      requirementsFileName: params.requirementsFile.name,
      proposalFileKey: uploadUrls.proposalFileKey,
      proposalFileName: params.proposalFile.name,
      proposalContentType: params.proposalFile.type,
      documentUploadProviderId: uploadUrls.documentUploadProviderId,
      modelId: params.modelId,
    });

    if (result.jobId) {
      setJobId(result.jobId);
      setIsPolling(true);
    }

    return result;
  }, [agentId, analyzeProposal, getUploadUrls]);

  const reset = useCallback(() => {
    hasRestoredJob.current = true; // Prevent re-restoring the old job after an explicit reset
    setJobId(null);
    setIsPolling(false);
    setIsUploading(false);
    setJobStatus('idle');
    setProgress('');
    setError(null);
    setCompletedJobId(null);
  }, []);

  const results: ComplianceResult[] | null = resultsData?.results ?? null;

  return {
    analyzeDocument,
    reset,
    isProcessing: isGettingUrls || isUploading || isSubmitting || isPolling,
    jobStatus,
    progress,
    results,
    completedJobId,
    error,
  };
}

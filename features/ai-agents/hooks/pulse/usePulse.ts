import { useState, useEffect, useCallback, useRef } from 'react';

import useGetPulseUploadUrl from '@/features/ai-agents/api/pulse/get-pulse-upload-url';
import useStartPulseAnalysis from '@/features/ai-agents/api/pulse/start-pulse-analysis';
import usePulseStatus from '@/features/ai-agents/api/pulse/get-pulse-status';
import useActivePulseJob from '@/features/ai-agents/api/pulse/get-active-pulse-job';
import usePulseResults from '@/features/ai-agents/api/pulse/get-pulse-results';
import {
  PulseUserError,
  formatPulseError,
  stoppedUnexpectedlyError,
  storageUnavailableError,
  uploadNetworkError,
  uploadTimedOutError,
} from '@/features/ai-agents/utils/pulse/pulseErrors';
import type { JobStatusType } from '@/features/ai-agents/utils/shared/types';
import type { PulseJobConfig } from '@/features/ai-agents/types/pulse/surveyAnalysis';

const UPLOAD_TIMEOUT = 300000;

type HookJobStatus = JobStatusType | 'idle';

type StartAnalysisParams = {
  surveyFile: File;
  modelId: string;
  responseCount: number;
  config: PulseJobConfig;
  userGroupId?: string;
};

type UsePulseOptions = {
  onComplete?: () => void;
  onError?: (error: string) => void;
};

async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.timeout = UPLOAD_TIMEOUT;

    // A rejected PUT means the presigned storage target refused the file, not that the file is bad.
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(PulseUserError.from(storageUnavailableError()));
      }
    });

    xhr.addEventListener('error', () => reject(PulseUserError.from(uploadNetworkError())));
    xhr.addEventListener('timeout', () => reject(PulseUserError.from(uploadTimedOutError())));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
}

export function usePulse(agentId: string, options?: UsePulseOptions) {
  const { mutateAsync: getUploadUrl, isPending: isGettingUrl } = useGetPulseUploadUrl();
  const { mutateAsync: startPulseAnalysis, isPending: isSubmitting } = useStartPulseAnalysis();

  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<HookJobStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);

  // Prevents restoring the same server-side run twice, including after an explicit reset.
  const hasRestoredJob = useRef(false);

  const { data: activeJobData } = useActivePulseJob(agentId);
  const { data: statusData } = usePulseStatus(agentId, jobId);
  const { data: resultsData } = usePulseResults(agentId, completedJobId);

  useEffect(() => {
    if (hasRestoredJob.current || !activeJobData?.job || jobStatus !== 'idle') {
      return;
    }

    hasRestoredJob.current = true;
    setJobId(activeJobData.job.id);
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
      const message = statusData.error || formatPulseError(stoppedUnexpectedlyError());
      setIsPolling(false);
      setJobId(null);
      setJobStatus('error');
      setError(message);
      options?.onError?.(message);
    }
  }, [statusData, isPolling, jobId, options]);

  const startAnalysis = useCallback(async (params: StartAnalysisParams) => {
    setJobStatus('processing');
    setProgress('Preparing upload...');
    setError(null);
    setCompletedJobId(null);

    try {
      const upload = await getUploadUrl({
        agentId,
        surveyFileName: params.surveyFile.name,
      });

      setIsUploading(true);
      setProgress('Uploading survey...');

      try {
        await uploadToS3(upload.surveyPresignedUrl, params.surveyFile);
      } finally {
        setIsUploading(false);
      }

      setProgress('Queuing analysis job...');

      const result = await startPulseAnalysis({
        agentId,
        surveyFileKey: upload.surveyFileKey,
        surveyFileName: params.surveyFile.name,
        documentUploadProviderId: upload.documentUploadProviderId,
        modelId: params.modelId,
        responseCount: params.responseCount,
        ...params.config,
        userGroupId: params.userGroupId,
      });

      if (result.jobId) {
        setJobId(result.jobId);
        setIsPolling(true);
      }

      return result;
    } catch (startError) {
      // The page shows the error from the rejection, so the hook only returns to idle.
      setJobStatus('idle');
      setProgress('');
      throw startError;
    }
  }, [agentId, getUploadUrl, startPulseAnalysis]);

  const reset = useCallback(() => {
    hasRestoredJob.current = true;
    setJobId(null);
    setIsPolling(false);
    setIsUploading(false);
    setJobStatus('idle');
    setProgress('');
    setError(null);
    setCompletedJobId(null);
  }, []);

  return {
    startAnalysis,
    reset,
    isProcessing: isGettingUrl || isUploading || isSubmitting || isPolling,
    jobStatus,
    progress,
    resultsData: resultsData ?? null,
    completedJobId,
    error,
  };
}

/**
 * Hook: useOdram
 *
 * React hook for ODRAM risk assessment workflow. Handles:
 * 1. Obtaining presigned S3 URLs for all files
 * 2. Uploading files directly to S3
 * 3. Queuing the analysis job
 * 4. Polling for completion status and tracking per-question progress
 * 5. Auto-resuming any in-progress job when the user returns to the page
 * 6. Fetching persisted results from the database on completion
 *
 * Used by: features/ai-agents/components/odram/Agent.tsx
 */

import { useState, useEffect, useCallback, useRef } from 'react';

import useStartOdramAnalysis, {
  useGetOdramUploadUrls,
  useOdramStatus,
} from '@/features/ai-agents/api/odram/start-analysis';
import useActiveOdramJob from '@/features/ai-agents/api/odram/get-active-odram-job';
import useOdramResults from '@/features/ai-agents/api/odram/get-odram-results';
import type { JobStatusType } from '@/features/ai-agents/utils/shared/types';
import type { OdramQuestionResult, OdramAnalysisResults } from '@/features/ai-agents/types/odram/analysisResult';
import type { OdramDocumentMapping, OdramQuestionContext } from '@/features/ai-agents/utils/odram/worker/queue';

type HookJobStatus = JobStatusType | 'idle';

type StartAnalysisParams = {
  promptMatrixFile: File;
  odramFile: File;
  proposalFiles: File[];
  modelId: string;
  documentMapping: OdramDocumentMapping | null;
  questionContext: OdramQuestionContext | null;
};

type UseOdramOptions = {
  onComplete?: (results: OdramAnalysisResults) => void;
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

export function useOdram(agentId: string, options?: UseOdramOptions) {
  const { mutateAsync: startAnalysis, isPending: isSubmitting } = useStartOdramAnalysis();
  const { mutateAsync: getUploadUrls, isPending: isGettingUrls } = useGetOdramUploadUrls();

  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [jobStatus, setJobStatus] = useState<HookJobStatus>('idle');
  const [progress, setProgress] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<number | undefined>();
  const [totalQuestions, setTotalQuestions] = useState<number | undefined>();
  const [partialResults, setPartialResults] = useState<OdramQuestionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completedJobId, setCompletedJobId] = useState<string | null>(null);

  // Prevent restoring an active job more than once (e.g. after user resets and submits a new job)
  const hasRestoredJob = useRef(false);

  // Store callbacks in refs so effects don't re-fire when the inline options object changes identity
  const onCompleteRef = useRef(options?.onComplete);
  onCompleteRef.current = options?.onComplete;
  const onErrorRef = useRef(options?.onError);
  onErrorRef.current = options?.onError;

  const { data: activeJobData } = useActiveOdramJob(agentId);
  const { data: statusData } = useOdramStatus(agentId, jobId);
  const { data: resultsData } = useOdramResults(agentId, completedJobId);

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

  // Poll status and handle completion
  useEffect(() => {
    if (!statusData || !isPolling) {
      return;
    }

    if (statusData.progress) {
      setProgress(statusData.progress);
    }

    if (statusData.currentQuestion) {
      setCurrentQuestion(statusData.currentQuestion);
    }

    if (statusData.totalQuestions) {
      setTotalQuestions(statusData.totalQuestions);
    }

    if (statusData.partialResults) {
      setPartialResults(statusData.partialResults as OdramQuestionResult[]);
    }

    if (statusData.status === 'completed') {
      setIsPolling(false);
      setCompletedJobId(jobId);
      setJobId(null);
      setJobStatus('completed');
      setProgress('Analysis complete!');
    } else if (statusData.status === 'error') {
      setIsPolling(false);
      setJobId(null);
      setJobStatus('error');
      setError(statusData.error || 'An error occurred during analysis');
      onErrorRef.current?.(statusData.error || 'An error occurred during analysis');
    }
  }, [statusData, isPolling, jobId]);

  // Fetch persisted results from DB when job completes
  useEffect(() => {
    if (!resultsData) {
      return;
    }

    const analysisResults: OdramAnalysisResults = {
      questions: resultsData.results.map((r) => ({
        questionId: r.questionId,
        questionName: r.questionName,
        teamRating: r.teamRating,
        independentRating: r.independentRating,
        overallAssessment: r.overallAssessment,
        keyFeedback: JSON.parse(r.keyFeedback) as string[],
      })) as OdramQuestionResult[],
      summary: resultsData.summary,
    };

    onCompleteRef.current?.(analysisResults);
  }, [resultsData]);

  const results: OdramAnalysisResults | null = resultsData
    ? {
      questions: resultsData.results.map((r) => ({
        questionId: r.questionId,
        questionName: r.questionName,
        teamRating: r.teamRating,
        independentRating: r.independentRating,
        overallAssessment: r.overallAssessment,
        keyFeedback: JSON.parse(r.keyFeedback) as string[],
      })) as OdramQuestionResult[],
      summary: resultsData.summary,
    }
    : null;

  const startOdramAnalysis = useCallback(async (params: StartAnalysisParams) => {
    setJobStatus('processing');
    setProgress('Preparing upload...');
    setPartialResults([]);
    setCurrentQuestion(undefined);
    setTotalQuestions(undefined);
    setError(null);
    setCompletedJobId(null);

    // Step 1: Get presigned URLs for all files
    const uploadUrls = await getUploadUrls({
      agentId,
      promptMatrixFile: {
        fileName: params.promptMatrixFile.name,
        contentType: params.promptMatrixFile.type,
      },
      odramFile: {
        fileName: params.odramFile.name,
        contentType: params.odramFile.type,
      },
      proposalFiles: params.proposalFiles.map((f) => ({
        fileName: f.name,
        contentType: f.type,
      })),
    });

    // Step 2: Upload all files directly to S3
    setIsUploading(true);
    setProgress('Uploading files to storage...');

    await Promise.all([
      uploadToS3(uploadUrls.promptMatrixUpload.presignedUrl, params.promptMatrixFile),
      uploadToS3(uploadUrls.odramUpload.presignedUrl, params.odramFile),
      ...uploadUrls.proposalUploads.map((upload, i) =>
        uploadToS3(upload.presignedUrl, params.proposalFiles[i]),
      ),
    ]);

    setIsUploading(false);
    setProgress('Queuing analysis job...');

    // Step 3: Trigger analysis with file keys
    const result = await startAnalysis({
      agentId,
      promptMatrixFileKey: uploadUrls.promptMatrixUpload.fileKey,
      promptMatrixFileName: uploadUrls.promptMatrixUpload.fileName,
      promptMatrixContentType: uploadUrls.promptMatrixUpload.contentType,
      odramFileKey: uploadUrls.odramUpload.fileKey,
      odramFileName: uploadUrls.odramUpload.fileName,
      odramContentType: uploadUrls.odramUpload.contentType,
      proposalFiles: uploadUrls.proposalUploads.map((upload) => ({
        fileKey: upload.fileKey,
        fileName: upload.fileName,
        contentType: upload.contentType,
      })),
      documentUploadProviderId: uploadUrls.documentUploadProviderId,
      modelId: params.modelId,
      documentMapping: params.documentMapping,
      questionContext: params.questionContext,
    });

    if (result.jobId) {
      setJobId(result.jobId);
      setIsPolling(true);
    }

    return result;
  }, [agentId, startAnalysis, getUploadUrls]);

  const reset = useCallback(() => {
    hasRestoredJob.current = true; // Prevent re-restoring the old job after an explicit reset
    setJobId(null);
    setIsPolling(false);
    setIsUploading(false);
    setJobStatus('idle');
    setProgress('');
    setCurrentQuestion(undefined);
    setTotalQuestions(undefined);
    setPartialResults([]);
    setError(null);
    setCompletedJobId(null);
  }, []);

  return {
    startOdramAnalysis,
    reset,
    isProcessing: isGettingUrls || isUploading || isSubmitting || isPolling,
    jobStatus,
    progress,
    currentQuestion,
    totalQuestions,
    partialResults,
    results,
    completedJobId,
    error,
  };
}

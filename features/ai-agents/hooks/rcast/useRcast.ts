import { useState, useEffect } from 'react';

import { trpc } from '@/libs';
import useUploadRateCard from '@/features/ai-agents/api/rcast/upload-rate-card';
import { useRcastStatus } from '@/features/ai-agents/api/rcast/get-rcast-status';
import type { JobStatusType } from '@/features/ai-agents/utils/shared/types';

type HookJobStatus = JobStatusType | 'idle';

type UploadRateCardParams = {
  fileContent: string;
  fileName: string;
  modelId: string;
  userGroupId?: string;
};

type UseRcastOptions = {
  onComplete?: () => void;
};

export function useRcast(agentId: string, options?: UseRcastOptions) {
  const utils = trpc.useUtils();
  const { mutateAsync: uploadRateCard, isPending: isUploading } = useUploadRateCard();
  const [jobId, setJobId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [jobStatus, setJobStatus] = useState<HookJobStatus>('idle');

  const { refetch: checkStatus } = useRcastStatus(agentId, jobId);

  useEffect(() => {
    if (!jobId || !isPolling) {
      return;
    }

    const pollInterval = setInterval(async () => {
      const { data } = await checkStatus();

      if (data?.status === 'completed') {
        setIsPolling(false);
        setJobId(null);
        setJobStatus('completed');
        utils.aiAgents.getRateCards.invalidate({ aiAgentId: agentId });
        options?.onComplete?.();
        clearInterval(pollInterval);
      } else if (data?.status === 'error') {
        setIsPolling(false);
        setJobId(null);
        setJobStatus('error');
        clearInterval(pollInterval);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [jobId, isPolling, checkStatus]);

  const uploadAndProcessRateCard = async (params: UploadRateCardParams | undefined) => {
    if (!params) {
      return;
    }

    setJobStatus('processing');

    const result = await uploadRateCard({
      aiAgentId: agentId,
      fileContent: params.fileContent,
      fileName: params.fileName,
      modelId: params.modelId,
      userGroupId: params.userGroupId,
    });

    if (result.jobId) {
      setJobId(result.jobId);
      setIsPolling(true);
    }

    return result;
  };

  return {
    uploadAndProcessRateCard,
    isProcessing: isUploading || isPolling,
    jobStatus,
  };
}

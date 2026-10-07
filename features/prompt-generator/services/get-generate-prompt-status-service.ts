import { storage } from '@/server/storage/redis';
import { AiResponse } from '@/features/ai-provider/sources/types';

type GeneratePromptJobStatus = {
  status: 'queued' | 'processing' | 'done' | 'error';
  response?: AiResponse;
  error?: string;
};

export async function getGeneratePromptJobStatus(jobId: string): Promise<GeneratePromptJobStatus> {
  const data = await storage.hgetall(`prompt-generator-job:${jobId}`);

  const status = (data?.status ?? 'queued') as 'queued' | 'processing' | 'done' | 'error';

  return {
    status,
    response: data?.response ? JSON.parse(data.response) : undefined,
    error: data?.error ?? undefined,
  };
}

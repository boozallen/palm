import { storage } from '@/server/storage/redis';
import { AiResponse } from '@/features/ai-provider/sources/types';

type PlaygroundJobStatus = {
  status: 'queued' | 'processing' | 'done' | 'error';
  results?: AiResponse[];
  error?: string;
};

export async function getPlaygroundJobStatus(jobId: string): Promise<PlaygroundJobStatus> {
  const data = await storage.hgetall(`playground-job:${jobId}`);

  const status = (data?.status ?? 'queued') as 'queued' | 'processing' | 'done' | 'error';

  return {
    status,
    results: data?.results ? JSON.parse(data.results) : undefined,
    error: data?.error ?? undefined,
  };
}

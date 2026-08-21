import { storage } from '@/server/storage/redis';

type RenderJobStatus = {
  status: 'queued' | 'processing' | 'done' | 'error';
  progress?: string;
  downloadUrl?: string;
  error?: string;
};

export async function getRenderJobStatus(jobId: string): Promise<RenderJobStatus> {
  const data = await storage.hgetall(`render-job:${jobId}`);

  const status = (data?.status ?? 'queued') as 'queued' | 'processing' | 'done' | 'error';

  return {
    status,
    progress: data?.progress ?? undefined,
    downloadUrl: data?.downloadUrl ?? undefined,
    error: data?.error ?? undefined,
  };
}

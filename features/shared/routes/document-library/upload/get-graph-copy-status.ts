import { z } from 'zod';
import { procedure } from '@/server/trpc';
import { storage } from '@/server/storage/redis';
import { NotFound } from '@/features/shared/errors/routeErrors';

const inputSchema = z.object({
  jobId: z.string().uuid(),
});

const outputSchema = z.object({
  status: z.enum(['queued', 'processing', 'completed', 'error']),
  progress: z.string().optional(),
  error: z.string().optional(),
  results: z.object({
    graphCopied: z.boolean(),
    filename: z.string(),
    sourceDocumentId: z.string(),
    targetDocumentId: z.string(),
  }).optional(),
});

export default procedure
  .input(inputSchema)
  .output(outputSchema)
  .query(async ({ input }) => {
    const { jobId } = input;

    if (!storage) {
      throw new Error('Storage is not available');
    }

    const jobData = await storage.hgetall(`graph-copy-job:${jobId}`);

    if (!jobData || Object.keys(jobData).length === 0) {
      throw NotFound('Job not found');
    }

    const response: z.infer<typeof outputSchema> = {
      status: jobData.status as 'queued' | 'processing' | 'completed' | 'error',
      progress: jobData.progress,
      error: jobData.error,
    };

    if (jobData.results) {
      try {
        response.results = JSON.parse(jobData.results);
      } catch {
        // Ignore parse errors
      }
    }

    return response;
  });

import { v4 as uuid } from 'uuid';

import { logger } from '@/server/logger';
import { storage } from '@/server/storage/redis';
import { getRenderQueue } from '@/features/video-generation/utils/worker/renderQueue';

export async function queueRenderJob(
  slidesJson: string,
  userId: string,
): Promise<{ jobId: string }> {
  let extractedJson: string;
  let theme: string | undefined;

  try {
    const parsed = JSON.parse(slidesJson);
    if (Array.isArray(parsed)) {
      extractedJson = slidesJson;
    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.slides)) {
      extractedJson = JSON.stringify(parsed.slides);
      theme = parsed.theme;
    } else {
      throw new Error('Expected JSON array or wrapper object with slides array');
    }
  } catch {
    // Fall back to extracting the first JSON array in the string (legacy path)
    const arrayMatch = slidesJson.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      throw new Error('slidesJson must be a valid JSON array');
    }
    extractedJson = arrayMatch[0];
  }

  const jobId = uuid();
  const queue = getRenderQueue();

  if (!queue) {
    throw new Error('Render queue not available');
  }

  await storage.hset(`render-job:${jobId}`, {
    status: 'queued',
    created: Date.now(),
    userId,
  });

  await queue.add('renderJob', { jobId, slidesJson: extractedJson, theme, userId });

  logger.info('Render job queued', { jobId, userId });

  return { jobId };
}

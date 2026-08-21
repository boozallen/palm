import { z } from 'zod';
import { TRPCError } from '@trpc/server';

import { procedure } from '@/server/trpc';
import { logger } from '@/server/logger';
import { getArtifactContent } from '@/features/video-generation/dal/getArtifactContent';
import { synthesizeNarrations } from '@/features/video-generation/services/synthesize-narration-service';
import type { VideoSlide } from '@/features/video-generation/types/video.types';

const VideoSlideWithAudioZodSchema = z.object({
  id: z.string(),
  heading: z.string(),
  body: z.string().nullish().transform((v) => v ?? undefined),
  narration: z.string().nullish().transform((v) => v ?? undefined),
  imageSearchTerm: z.string().nullish().transform((v) => v ?? undefined),
  bullets: z.array(z.string()).nullish().transform((v) => v ?? undefined),
  layout: z.enum(['title', 'text', 'image-right', 'full-image', 'bullets']).nullish().transform((v) => v ?? undefined),
  audioDataUrl: z.string().optional(),
  durationInFrames: z.number(),
});

export const synthesizeNarration = procedure
  .input(z.object({ artifactId: z.string().uuid() }))
  .output(z.object({ slides: z.array(VideoSlideWithAudioZodSchema) }))
  .query(async ({ input, ctx }) => {
    const content = await getArtifactContent(input.artifactId, ctx.userId);

    if (!content) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Artifact not found' });
    }

    let slides: VideoSlide[] = [];
    try {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          slides = parsed as VideoSlide[];
        }
      }
    } catch {
      logger.warn('synthesizeNarration: failed to parse artifact content', { artifactId: input.artifactId });
    }

    try {
      const synthesized = await synthesizeNarrations(slides);
      return { slides: synthesized };
    } catch (error) {
      logger.error('synthesizeNarration failed, falling back to silent slides', { error });
      return {
        slides: slides.map((slide) => ({
          ...slide,
          durationInFrames: 90,
        })),
      };
    }
  });

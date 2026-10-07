import path from 'path';
import os from 'os';
import fs from 'fs/promises';

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, selectComposition, renderMedia } from '@remotion/renderer';

import { getConfig } from '@/server/config';
import { logger } from '@/server/logger';
import { synthesizeNarrationsWithExactTiming } from '@/features/video-generation/utils/worker/polly-worker-service';
import { fetchImageAsDataUrl, queryToSeed } from '@/features/video-generation/utils/worker/image-worker-service';
import type { VideoSlide, VideoSlideWithAudio } from '@/features/video-generation/types/video.types';

let bundleCache: string | null = null;

async function getBundleUrl(): Promise<string> {
  if (bundleCache) {
    return bundleCache;
  }
  const bundled = await bundle({
    entryPoint: path.resolve('./video/index.tsx'),
    webpackOverride: (config: import('webpack').Configuration) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(config.resolve?.alias as Record<string, string> ?? {}),
          '@': path.resolve('.'),
        },
      },
    }),
  });
  bundleCache = bundled;
  return bundled;
}

export async function renderSlidesToMp4(
  slides: VideoSlide[],
  userId: string,
  jobId: string,
  onProgress?: (pct: number) => void,
  theme?: string,
): Promise<string> {
  const config = getConfig();

  // Step 1: Synthesize narrations
  logger.info('Synthesizing narrations for render', { jobId, slideCount: slides.length });
  const slidesWithAudio = await synthesizeNarrationsWithExactTiming(slides);
  const audioCount = slidesWithAudio.filter((s) => s.audioDataUrl).length;
  logger.info('Narration synthesis complete', { jobId, audioCount, slideCount: slidesWithAudio.length });

  // Step 2: Pre-fetch images as data URLs so the renderer doesn't need auth-gated endpoints
  logger.info('Pre-fetching images for render', { jobId });
  const slidesWithMedia: VideoSlideWithAudio[] = await Promise.all(
    slidesWithAudio.map(async (slide) => {
      if (!slide.imageSearchTerm) {
        return slide;
      }
      const seed = queryToSeed(slide.imageSearchTerm, slide.id);
      const imageDataUrl = await fetchImageAsDataUrl(slide.imageSearchTerm, seed);
      return imageDataUrl
        ? { ...slide, imageDataUrl }
        : { ...slide, imageSearchTerm: undefined };
    }),
  );

  // Step 3: Bundle the Remotion composition (cached after first call)
  logger.info('Bundling Remotion composition', { jobId });
  const serveUrl = await getBundleUrl();

  // Step 4: Ensure Remotion's headless browser is downloaded (no-op if already present in
  // node_modules/.remotion after being pre-baked into the Docker image during build)
  await ensureBrowser();

  // Step 5: Select the composition to get durationInFrames + other metadata
  const composition = await selectComposition({
    serveUrl,
    id: 'SlideshowVideo',
    inputProps: { slides: slidesWithMedia, theme },
  });

  // Step 6: Render to MP4
  const outputLocation = path.join(os.tmpdir(), `${jobId}.mp4`);
  logger.info('Rendering MP4', { jobId, outputLocation });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps: { slides: slidesWithMedia, theme },
    concurrency: 1,
    chromiumOptions: { disableWebSecurity: true, gl: 'swiftshader' },
    onProgress: ({ progress }: { progress: number }) => {
      onProgress?.(progress);
    },
  });

  // Step 7: Read rendered file and clean up temp
  const fileBuffer = await fs.readFile(outputLocation);
  await fs.unlink(outputLocation).catch((err) => {
    logger.warn('Failed to delete temp render file', { outputLocation, error: err });
  });

  // Step 8: Upload to S3
  const awsCreds = config.documentUploadProvider.aws;
  const s3Client = new S3Client({
    region: awsCreds.region,
    credentials: {
      accessKeyId: awsCreds.accessKeyId,
      secretAccessKey: awsCreds.secretAccessKey,
      sessionToken: awsCreds.sessionToken || undefined,
    },
  });

  const bucket = config.s3BucketName;
  const key = `video-exports/${userId}/${jobId}.mp4`;

  logger.info('Uploading MP4 to S3', { jobId, bucket, key });
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: 'video/mp4',
    }),
  );

  // Step 9: Generate presigned download URL (1 hour expiry).
  // ResponseContentDisposition forces the browser to download rather than play inline.
  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${jobId}.mp4"`,
    }),
    { expiresIn: 3600 },
  );

  logger.info('MP4 render and upload complete', { jobId });
  return downloadUrl;
}

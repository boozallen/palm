import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

import { getConfig } from '@/server/config';
import { logger } from '@/server/logger';
import { VideoSlide, VideoSlideWithAudio } from '@/features/video-generation/types/video.types';
import {
  FRAMES_PER_SLIDE,
  FPS,
  VOICE_ID,
  estimateDurationInFrames,
} from '@/features/video-generation/utils/polly-constants';

const PCM_SAMPLE_RATE = 16000;
const PCM_BYTES_PER_SAMPLE = 2; // 16-bit mono

export function buildWavBuffer(pcmBytes: Uint8Array): Buffer {
  const dataSize = pcmBytes.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(PCM_SAMPLE_RATE, 24);
  header.writeUInt32LE(PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE, 28);
  header.writeUInt16LE(PCM_BYTES_PER_SAMPLE, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, Buffer.from(pcmBytes)]);
}

export async function synthesizeNarrationsWithExactTiming(slides: VideoSlide[]): Promise<VideoSlideWithAudio[]> {
  const config = getConfig().polly;

  if (!config.accessKeyId || !config.secretAccessKey) {
    logger.warn('Polly credentials not configured — returning silent slides.');
    return slides.map((slide) => ({
      ...slide,
      durationInFrames: slide.narration ? estimateDurationInFrames(slide.narration) : FRAMES_PER_SLIDE,
    }));
  }

  const pollyClient = new PollyClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      sessionToken: config.sessionToken || undefined,
    },
  });

  return Promise.all(
    slides.map(async (slide): Promise<VideoSlideWithAudio> => {
      if (!slide.narration) {
        return { ...slide, durationInFrames: FRAMES_PER_SLIDE };
      }

      try {
        const command = new SynthesizeSpeechCommand({
          Text: slide.narration,
          OutputFormat: 'pcm',
          VoiceId: VOICE_ID,
          Engine: 'neural',
          SampleRate: String(PCM_SAMPLE_RATE),
        });

        const response = await pollyClient.send(command);

        if (!response.AudioStream) {
          logger.warn('Polly PCM returned no AudioStream for slide', { slideId: slide.id });
          return { ...slide, durationInFrames: estimateDurationInFrames(slide.narration) };
        }

        const pcmBytes = await response.AudioStream.transformToByteArray();

        if (!pcmBytes.length) {
          logger.warn('Polly PCM returned empty audio for slide', { slideId: slide.id });
          return { ...slide, durationInFrames: estimateDurationInFrames(slide.narration) };
        }

        const durationInSeconds = pcmBytes.length / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE);
        const durationInFrames = Math.ceil(durationInSeconds * FPS) + 60;
        const audioDataUrl = `data:audio/wav;base64,${buildWavBuffer(pcmBytes).toString('base64')}`;

        return { ...slide, audioDataUrl, durationInFrames };
      } catch (error) {
        const errMessage = (error as Error).message ?? String(error);
        const errCode = (error as { name?: string }).name ?? 'UnknownError';
        logger.error('Polly PCM synthesis failed for slide', {
          slideId: slide.id,
          errorCode: errCode,
          errorMessage: errMessage,
        });
        return { ...slide, durationInFrames: estimateDurationInFrames(slide.narration) };
      }
    }),
  );
}

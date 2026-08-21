import { VideoSlide, VideoSlideWithAudio } from '@/features/video-generation/types/video.types';
import { synthesizeNarrationsWithExactTiming } from '@/features/video-generation/utils/worker/polly-worker-service';

export async function synthesizeNarrations(slides: VideoSlide[]): Promise<VideoSlideWithAudio[]> {
  return synthesizeNarrationsWithExactTiming(slides);
}

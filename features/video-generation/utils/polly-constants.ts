export const FRAMES_PER_SLIDE = 90;
export const FPS = 30;
export const WORDS_PER_SECOND = 2.5;
export const BUFFER_FRAMES = 30;
export const VOICE_ID = 'Ruth';

export function estimateDurationInFrames(narration: string): number {
  const words = narration.trim().split(/\s+/).length;
  return Math.ceil((words / WORDS_PER_SECOND) * FPS) + BUFFER_FRAMES;
}

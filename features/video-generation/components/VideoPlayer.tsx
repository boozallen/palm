import { Player } from '@remotion/player';

import { trpc } from '@/libs/trpc';
import { SlideshowVideo, computeTotalDuration } from '@/features/video-generation/compositions/SlideshowVideo';
import { VideoSlide, VideoSlideWithAudio, VideoTheme } from '@/features/video-generation/types/video.types';
import CenteredLoader from '@/features/shared/components/CenteredLoader';

const DEFAULT_DURATION = 150;
const FPS = 30;

type Props = {
  content: string;
  artifactId: string;
};

export default function VideoPlayer({ content, artifactId }: Props) {
  let rawSlides: VideoSlide[] = [];
  let theme: VideoTheme | undefined;

  try {
    // Support both {"theme":"...","slides":[...]} wrapper and bare [...] array
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (parsed && Array.isArray(parsed.slides)) {
        rawSlides = parsed.slides as VideoSlide[];
        theme = parsed.theme as VideoTheme | undefined;
      }
    } else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]);
        if (Array.isArray(parsed)) {
          rawSlides = parsed as VideoSlide[];
        }
      }
    }
  } catch {
    // invalid content — render empty player
  }

  const hasSomeNarration = rawSlides.some((s) => s.narration);

  const { data, isLoading } = trpc.video.synthesizeNarration.useQuery(
    { artifactId },
    { enabled: hasSomeNarration },
  );

  if (hasSomeNarration && isLoading) {
    return <CenteredLoader />;
  }

  const slidesWithAudio: VideoSlideWithAudio[] = data
    ? data.slides
    : rawSlides.map((s) => ({ ...s, durationInFrames: DEFAULT_DURATION }));

  const durationInFrames = computeTotalDuration(slidesWithAudio);

  return (
    <Player
      component={SlideshowVideo}
      inputProps={{ slides: slidesWithAudio, theme }}
      durationInFrames={durationInFrames}
      fps={FPS}
      compositionWidth={1280}
      compositionHeight={720}
      style={{ width: '100%' }}
      controls
    />
  );
}

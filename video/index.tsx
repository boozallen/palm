// @ts-ignore — remotion re-exports via .js paths which TS moduleResolution:node can't resolve
import { Composition, registerRoot } from 'remotion';

import { SlideshowVideo, computeTotalDuration } from '@/features/video-generation/compositions/SlideshowVideo';
import type { SlideshowVideoProps } from '@/features/video-generation/types/video.types';

const RemotionRoot = () => (
  <Composition
    id='SlideshowVideo'
    component={SlideshowVideo}
    fps={30}
    width={1280}
    height={720}
    defaultProps={{ slides: [] } as SlideshowVideoProps}
    calculateMetadata={({ props }: { props: SlideshowVideoProps }) => ({
      durationInFrames: computeTotalDuration(props.slides) || 150,
    })}
  />
);

registerRoot(RemotionRoot);

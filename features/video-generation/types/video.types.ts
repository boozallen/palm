export type VideoMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ChatVideoProps = {
  messages: VideoMessage[];
};

export type VideoSlideLayout = 'title' | 'text' | 'image-right' | 'full-image' | 'bullets';

export type VideoTheme = 'default' | 'corporate-minimal' | 'tech-forward' | 'data-driven' | 'magazine-editorial' | 'executive-brief';

export type VideoSlide = {
  id: string;
  heading: string;
  body?: string;
  narration?: string;
  imageSearchTerm?: string;
  bullets?: string[];
  layout?: VideoSlideLayout;
};

export type VideoSlideWithAudio = VideoSlide & {
  audioDataUrl?: string;
  imageDataUrl?: string;
  durationInFrames: number;
};

export type SlideshowVideoProps = {
  slides: VideoSlideWithAudio[];
  theme?: VideoTheme;
};

import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { SlideshowVideoProps, VideoSlideLayout, VideoSlideWithAudio, VideoTheme } from '@/features/video-generation/types/video.types';

export const SLIDE_TRANSITION_FRAMES = 18;

type ThemeConfig = {
  bg: string;
  bgAccent: string;
  accent: string;
  accentAlt: string;
  heading: string;
  body: string;
  accentLine: string;
  isDark: boolean;
  // magazine-editorial chrome bars
  chrome?: { text: string; mono: boolean };
};

const THEMES: Record<VideoTheme, ThemeConfig> = {
  'default': {
    bg: '#ffffff',
    bgAccent: '#eff6ff',
    accent: '#2563eb',
    accentAlt: '#3b82f6',
    heading: '#0f172a',
    body: '#334155',
    accentLine: '#2563eb',
    isDark: false,
  },
  'corporate-minimal': {
    bg: '#f8fafc',
    bgAccent: '#e2e8f0',
    accent: '#475569',
    accentAlt: '#64748b',
    heading: '#0f172a',
    body: '#475569',
    accentLine: '#475569',
    isDark: false,
  },
  'tech-forward': {
    bg: '#0a0a1a',
    bgAccent: '#0d1117',
    accent: '#6366f1',
    accentAlt: '#818cf8',
    heading: '#f8fafc',
    body: 'rgba(248,250,252,0.72)',
    accentLine: 'linear-gradient(to right, #6366f1, #818cf8)',
    isDark: true,
  },
  'data-driven': {
    bg: '#f0fdf4',
    bgAccent: '#bbf7d0',
    accent: '#16a34a',
    accentAlt: '#22c55e',
    heading: '#14532d',
    body: '#166534',
    accentLine: '#16a34a',
    isDark: false,
  },
  // Matches HTML presentation: ink #0e2841, paper #f7f8fa, accent #23d2d6
  'magazine-editorial': {
    bg: '#0e2841',
    bgAccent: '#0a1f3d',
    accent: '#23d2d6',
    accentAlt: '#00a5b5',
    heading: '#f7f8fa',
    body: 'rgba(247,248,250,0.82)',
    accentLine: '#23d2d6',
    isDark: true,
    chrome: { text: '#f7f8fa', mono: true },
  },
  'executive-brief': {
    bg: '#0c0b09',
    bgAccent: '#1c1a10',
    accent: '#d97706',
    accentAlt: '#f59e0b',
    heading: '#fafaf9',
    body: 'rgba(250,250,249,0.72)',
    accentLine: 'linear-gradient(to right, #d97706, #f59e0b)',
    isDark: true,
  },
};

export function computeTotalDuration(slides: VideoSlideWithAudio[]): number {
  if (slides.length === 0) {
    return 30;
  }
  const total = slides.reduce((sum, s) => sum + s.durationInFrames, 0);
  return Math.max(30, total - SLIDE_TRANSITION_FRAMES * (slides.length - 1));
}

function getEffectiveLayout(slide: VideoSlideWithAudio, index: number): VideoSlideLayout {
  if (slide.layout) {
    return slide.layout;
  }
  if (index === 0 && !slide.body && !slide.bullets?.length) {
    return 'title';
  }
  if (slide.bullets?.length) {
    return 'bullets';
  }
  return 'text';
}

// ─── Word-by-word heading animation ──────────────────────────────────────────
type AnimatedHeadingProps = {
  text: string;
  localFrame: number;
  fps: number;
  fontSize: string;
  fontWeight: number;
  color: string;
  lineHeight: number;
  letterSpacing?: string;
  startDelay?: number;
};

function AnimatedHeading({ text, localFrame, fps, fontSize, fontWeight, color, lineHeight, letterSpacing, startDelay = 0 }: AnimatedHeadingProps) {
  const words = (text ?? '').split(/\s+/).filter(Boolean);
  return (
    <div style={{ fontSize, fontWeight, color, letterSpacing, display: 'flex', flexWrap: 'wrap', columnGap: '0.28em', rowGap: '0.08em', lineHeight }}>
      {words.map((word, i) => {
        const wp = spring({
          frame: Math.max(0, localFrame - startDelay - i * 3),
          fps,
          config: { damping: 18, stiffness: 90 },
        });
        const wOpacity = interpolate(wp, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const wY = interpolate(wp, [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        return (
          <span
            key={i}
            style={{
              opacity: wOpacity,
              transform: `translateY(${wY}px)`,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

// ─── Accent bar above headings (matches HTML presentation style) ──────────────
function AccentBar({ theme, opacity }: { theme: ThemeConfig; opacity: number }) {
  return (
    <div
      style={{
        width: '64px',
        height: '3px',
        background: theme.accentLine,
        marginBottom: '18px',
        borderRadius: '2px',
        opacity,
      }}
    />
  );
}

// ─── Magazine-editorial chrome + foot bars ────────────────────────────────────
function MagazineChrome({ slide, slideIndex, totalSlides, opacity, theme }: {
  slide: VideoSlideWithAudio;
  slideIndex: number;
  totalSlides: number;
  opacity: number;
  theme: ThemeConfig;
}) {
  const monoStyle: React.CSSProperties = {
    fontFamily: '"IBM Plex Mono", "Fira Mono", ui-monospace, monospace',
    fontSize: '13px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: theme.heading,
    opacity: opacity * 0.62,
  };
  const num = String(slideIndex + 1).padStart(2, '0');
  const tot = String(totalSlides).padStart(2, '0');
  return (
    <>
      {/* Top chrome bar */}
      <div
        style={{
          position: 'absolute',
          top: '36px',
          left: '56px',
          right: '56px',
          display: 'flex',
          justifyContent: 'space-between',
          ...monoStyle,
        }}
      >
        <span>{slide.heading.toUpperCase()}</span>
        <span>{num} / {tot}</span>
      </div>
      {/* Bottom foot bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '36px',
          left: '56px',
          right: '56px',
          display: 'flex',
          justifyContent: 'space-between',
          ...monoStyle,
        }}
      >
        <span style={{ fontFamily: '"Playfair Display", Georgia, serif', letterSpacing: '0.04em', textTransform: 'none' }}>
          {slide.body ? slide.body.split(' ').slice(0, 4).join(' ') : slide.heading}
        </span>
        <span>2026</span>
      </div>
    </>
  );
}

// ─── Layout prop types ────────────────────────────────────────────────────────
type LayoutProps = {
  slide: VideoSlideWithAudio;
  slideIndex: number;
  bodyOpacity: number;
  bodyY: number;
  localFrame: number;
  fps: number;
  theme: ThemeConfig;
};

// ─── Layouts ──────────────────────────────────────────────────────────────────
function TitleLayout({ slide, bodyOpacity, bodyY, localFrame, fps, theme }: LayoutProps) {
  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: '80px',
      }}
    >
      {/* Subtle side accent stripe */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '20%',
          bottom: '20%',
          width: '4px',
          background: theme.accentLine,
          opacity: bodyOpacity,
          borderRadius: '0 2px 2px 0',
        }}
      />

      <div style={{ textAlign: 'center', maxWidth: '900px' }}>
        <AnimatedHeading
          text={slide.heading}
          localFrame={localFrame}
          fps={fps}
          startDelay={4}
          fontSize='72px'
          fontWeight={700}
          color={theme.heading}
          lineHeight={1.12}
          letterSpacing='-1px'
        />
        {slide.body && (
          <div
            style={{
              fontSize: '26px',
              color: theme.body,
              marginTop: '28px',
              lineHeight: 1.6,
              fontWeight: 400,
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
            }}
          >
            {slide.body}
          </div>
        )}
        <div
          style={{
            width: '56px',
            height: '3px',
            background: theme.accentLine,
            margin: '32px auto 0',
            borderRadius: '2px',
            opacity: bodyOpacity,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function TextLayout({ slide, bodyOpacity, bodyY, localFrame, fps, theme }: LayoutProps) {
  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 100px',
      }}
    >
      <AccentBar theme={theme} opacity={bodyOpacity} />
      <AnimatedHeading
        text={slide.heading}
        localFrame={localFrame}
        fps={fps}
        startDelay={4}
        fontSize='48px'
        fontWeight={700}
        color={theme.heading}
        lineHeight={1.2}
        letterSpacing='-0.5px'
      />
      {slide.body && (
        <div
          style={{
            fontSize: '24px',
            color: theme.body,
            lineHeight: 1.75,
            marginTop: '28px',
            fontWeight: 400,
            maxWidth: '800px',
            opacity: bodyOpacity,
            transform: `translateY(${bodyY}px)`,
          }}
        >
          {slide.body}
        </div>
      )}
    </AbsoluteFill>
  );
}

function ImageRightLayout({ slide, bodyOpacity, bodyY, localFrame, fps, theme }: LayoutProps) {
  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        display: 'flex',
        flexDirection: 'row',
        fontFamily: '"Inter", system-ui, sans-serif',
      }}
    >
      {/* Content — left 60% */}
      <div
        style={{
          flex: '0 0 60%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px 60px 80px 100px',
        }}
      >
        <AccentBar theme={theme} opacity={bodyOpacity} />
        <AnimatedHeading
          text={slide.heading}
          localFrame={localFrame}
          fps={fps}
          startDelay={4}
          fontSize='42px'
          fontWeight={700}
          color={theme.heading}
          lineHeight={1.25}
          letterSpacing='-0.5px'
        />
        {slide.body && (
          <div
            style={{
              fontSize: '22px',
              color: theme.body,
              lineHeight: 1.75,
              marginTop: '24px',
              fontWeight: 400,
              opacity: bodyOpacity,
              transform: `translateY(${bodyY}px)`,
            }}
          >
            {slide.body}
          </div>
        )}
      </div>

      {/* Accent panel — right 40% */}
      <div
        style={{
          flex: '0 0 40%',
          background: theme.bgAccent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: bodyOpacity,
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: theme.accentLine,
            opacity: 0.35,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function FullImageLayout({ slide, bodyOpacity, bodyY, localFrame, fps, theme }: LayoutProps) {
  return (
    <AbsoluteFill
      style={{
        background: theme.isDark ? theme.bgAccent : theme.accent,
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '80px 100px',
      }}
    >
      <AccentBar theme={{ ...theme, accentLine: theme.isDark ? theme.accentLine : '#ffffff' }} opacity={bodyOpacity} />
      <AnimatedHeading
        text={slide.heading}
        localFrame={localFrame}
        fps={fps}
        startDelay={4}
        fontSize='52px'
        fontWeight={700}
        color={theme.isDark ? theme.heading : '#ffffff'}
        lineHeight={1.18}
        letterSpacing='-0.5px'
      />
      {slide.body && (
        <div
          style={{
            fontSize: '22px',
            color: theme.isDark ? theme.body : 'rgba(255,255,255,0.85)',
            lineHeight: 1.6,
            marginTop: '16px',
            fontWeight: 400,
            maxWidth: '720px',
            opacity: bodyOpacity,
            transform: `translateY(${bodyY}px)`,
          }}
        >
          {slide.body}
        </div>
      )}
    </AbsoluteFill>
  );
}

function BulletsLayout({ slide, bodyOpacity, localFrame, fps, theme }: LayoutProps) {
  const bullets = slide.bullets ?? [];

  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        fontFamily: '"Inter", system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 100px',
      }}
    >
      <AccentBar theme={theme} opacity={bodyOpacity} />
      <AnimatedHeading
        text={slide.heading}
        localFrame={localFrame}
        fps={fps}
        startDelay={2}
        fontSize='46px'
        fontWeight={700}
        color={theme.heading}
        lineHeight={1.2}
        letterSpacing='-0.5px'
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginTop: '40px' }}>
        {bullets.map((bullet, i) => {
          const delay = 10 + i * 8;
          const bp = spring({
            frame: Math.max(0, localFrame - delay),
            fps,
            config: { damping: 22, stiffness: 80 },
          });
          const bOpacity = interpolate(bp, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const bX = interpolate(bp, [0, 1], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div
              key={`${slide.id}-b${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                opacity: bOpacity,
                transform: `translateX(${bX}px)`,
              }}
            >
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: theme.accent,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  fontSize: '26px',
                  color: theme.body,
                  lineHeight: 1.5,
                  fontWeight: 400,
                }}
              >
                {bullet}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ─── Slide sequence ───────────────────────────────────────────────────────────
type SlideSequenceProps = {
  slide: VideoSlideWithAudio;
  slideIndex: number;
  totalSlides: number;
  theme: ThemeConfig;
};

const SlideSequence: React.FC<SlideSequenceProps> = ({ slide, slideIndex, totalSlides, theme }) => {
  const localFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const T = SLIDE_TRANSITION_FRAMES;
  const d = slide.durationInFrames;

  const fadeIn = interpolate(localFrame, [0, T], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fadeOut = interpolate(localFrame, [d - T, d], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const slideOpacity = Math.min(fadeIn, fadeOut);

  const bodyProgress = spring({
    frame: Math.max(0, localFrame - Math.floor(T * 0.7)),
    fps,
    config: { damping: 24, stiffness: 60 },
  });
  const bodyOpacity = interpolate(bodyProgress, [0, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const bodyY = interpolate(bodyProgress, [0, 1], [20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  const layout = getEffectiveLayout(slide, slideIndex);
  const layoutProps: LayoutProps = { slide, slideIndex, bodyOpacity, bodyY, localFrame, fps, theme };

  return (
    <AbsoluteFill style={{ opacity: slideOpacity }}>
      {layout === 'title' && <TitleLayout {...layoutProps} />}
      {layout === 'text' && <TextLayout {...layoutProps} />}
      {layout === 'image-right' && <ImageRightLayout {...layoutProps} />}
      {layout === 'full-image' && <FullImageLayout {...layoutProps} />}
      {layout === 'bullets' && <BulletsLayout {...layoutProps} />}
      {theme.chrome && (
        <MagazineChrome
          slide={slide}
          slideIndex={slideIndex}
          totalSlides={totalSlides}
          opacity={bodyOpacity}
          theme={theme}
        />
      )}
    </AbsoluteFill>
  );
};

// ─── Root composition ─────────────────────────────────────────────────────────
export const SlideshowVideo: React.FC<SlideshowVideoProps> = ({ slides, theme: themeName }) => {
  const theme = THEMES[themeName ?? 'default'] ?? THEMES['default'];
  const T = SLIDE_TRANSITION_FRAMES;

  const startFrames = slides.reduce<number[]>((acc, slide, i) => {
    if (i === 0) {
      return [0];
    }
    return [...acc, acc[i - 1] + slides[i - 1].durationInFrames - T];
  }, []);

  return (
    <AbsoluteFill>
      {slides.map((s, i) =>
        s.audioDataUrl ? (
          <Sequence key={`audio-${s.id}`} from={startFrames[i]} durationInFrames={s.durationInFrames}>
            <Audio src={s.audioDataUrl} startFrom={0} />
          </Sequence>
        ) : null,
      )}

      {slides.map((slide, i) => (
        <Sequence key={slide.id} from={startFrames[i]} durationInFrames={slide.durationInFrames} layout='none'>
          <SlideSequence slide={slide} slideIndex={i} totalSlides={slides.length} theme={theme} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

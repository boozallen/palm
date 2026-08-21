import { Box, Center, Group, Loader, Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';

type Props = {
  artifactId: string;
};

type PreviewData = {
  slides: string[];
  count: number;
};

const PptxPreview = ({ artifactId }: Props) => {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [hoverSide, setHoverSide] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      setCurrent(0);
      try {
        const res = await fetch(`/api/chat/artifacts/pptx-preview?id=${artifactId}`);
        if (!res.ok) {
          throw new Error(`Failed to generate preview (${res.status})`);
        }
        const json = await res.json() as PreviewData;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render presentation');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [artifactId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrent(c => Math.max(0, c - 1));
      } else if (e.key === 'ArrowRight') {
        setCurrent(c => Math.min((data?.slides.length ?? 1) - 1, c + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [data]);

  const handleSlideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - left;
    if (clickX < width / 2) {
      setCurrent(c => Math.max(0, c - 1));
    } else {
      setCurrent(c => Math.min((data?.slides.length ?? 1) - 1, c + 1));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - left;
    setHoverSide(x < width / 2 ? 'left' : 'right');
  };

  if (loading) {
    return (
      <Center h='100%'>
        <Loader size='sm' />
      </Center>
    );
  }

  if (error) {
    return (
      <Center h='100%'>
        <Text size='sm' color='dimmed'>{error}</Text>
      </Center>
    );
  }

  const slides = data?.slides ?? [];
  const total = slides.length;
  const canPrev = current > 0;
  const canNext = current < total - 1;

  const cursor = hoverSide === 'left'
    ? (canPrev ? 'w-resize' : 'default')
    : (canNext ? 'e-resize' : 'default');

  return (
    <Box style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#1a1a1a' }}>
      <Box
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          cursor,
          userSelect: 'none',
        }}
        onClick={handleSlideClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverSide(null)}
      >
        {slides[current] && (
          <img
            key={current}
            src={`data:image/png;base64,${slides[current]}`}
            alt={`Slide ${current + 1}`}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      <Group
        position='center'
        spacing='md'
        style={{ padding: '10px', borderTop: '1px solid #333', background: '#111' }}
      >
        <Text size='sm' color='dimmed' style={{ minWidth: 80, textAlign: 'center' }}>
          {current + 1} / {total}
        </Text>
      </Group>
    </Box>
  );
};

export default PptxPreview;

import { Center, Loader, Text } from '@mantine/core';
import { useEffect, useState } from 'react';

type Props = {
  artifactId: string;
};

type PreviewData = {
  pages: string[];
  count: number;
};

const DocxPreview = ({ artifactId }: Props) => {
  const [data, setData] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const res = await fetch(`/api/chat/artifacts/docx-preview?id=${artifactId}`);
        if (!res.ok) {
          throw new Error(`Failed to generate preview (${res.status})`);
        }
        const json = await res.json() as PreviewData;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render document');
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

  const pages = data?.pages ?? [];

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#2a2a2a', padding: '16px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {pages.map((page, i) => (
          <img
            key={i}
            src={`data:image/png;base64,${page}`}
            alt={`Page ${i + 1}`}
            draggable={false}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default DocxPreview;

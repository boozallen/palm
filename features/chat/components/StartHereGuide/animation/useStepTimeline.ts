import { useEffect, useRef, useState } from 'react';

type Args = {
  active: boolean;
  beatCount: number;
  beatMs?: number;
  reducedMotion: boolean;
  onComplete?: () => void;
};

export default function useStepTimeline({ active, beatCount, beatMs = 900, reducedMotion, onComplete }: Args): number {
  const [beat, setBeat] = useState(0);

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) {
      setBeat(0);
      return;
    }

    if (reducedMotion) {
      setBeat(beatCount - 1);
      return;
    }

    setBeat(0);
    const interval = setInterval(() => {
      setBeat((prev) => Math.min(prev + 1, beatCount - 1));
    }, beatMs);

    return () => clearInterval(interval);
  }, [active, beatCount, beatMs, reducedMotion]);

  useEffect(() => {
    if (active && beat >= beatCount - 1) {
      onCompleteRef.current?.();
    }
  }, [active, beat, beatCount]);

  return beat;
}

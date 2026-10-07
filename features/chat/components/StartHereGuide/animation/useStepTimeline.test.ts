import { act, renderHook } from '@testing-library/react';

import useStepTimeline from './useStepTimeline';

describe('useStepTimeline', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('returns 0 when inactive', () => {
    const { result } = renderHook(() =>
      useStepTimeline({ active: false, beatCount: 3, reducedMotion: false }),
    );
    expect(result.current).toBe(0);
  });

  it('jumps to the final beat immediately under reduced motion', () => {
    const { result } = renderHook(() =>
      useStepTimeline({ active: true, beatCount: 3, reducedMotion: true }),
    );
    expect(result.current).toBe(2);
  });

  it('advances one beat per interval while active', () => {
    const { result } = renderHook(() =>
      useStepTimeline({ active: true, beatCount: 3, beatMs: 100, reducedMotion: false }),
    );
    expect(result.current).toBe(0);
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe(1);
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe(2);
  });

  it('stops on the last beat and does not overrun', () => {
    const { result } = renderHook(() =>
      useStepTimeline({ active: true, beatCount: 2, beatMs: 100, reducedMotion: false }),
    );
    act(() => { jest.advanceTimersByTime(500); });
    expect(result.current).toBe(1);
  });

  it('fires onComplete when the animated timeline reaches the final beat', () => {
    const onComplete = jest.fn();
    renderHook(() =>
      useStepTimeline({ active: true, beatCount: 3, beatMs: 100, reducedMotion: false, onComplete }),
    );
    act(() => { jest.advanceTimersByTime(100); });
    expect(onComplete).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(100); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('fires onComplete immediately under reduced motion', () => {
    const onComplete = jest.fn();
    renderHook(() =>
      useStepTimeline({ active: true, beatCount: 3, reducedMotion: true, onComplete }),
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('resets to 0 when active flips false', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useStepTimeline({ active, beatCount: 3, beatMs: 100, reducedMotion: false }),
      { initialProps: { active: true } },
    );
    act(() => { jest.advanceTimersByTime(100); });
    expect(result.current).toBe(1);
    rerender({ active: false });
    expect(result.current).toBe(0);
  });
});

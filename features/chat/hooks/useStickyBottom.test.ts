import { RefObject } from 'react';
import { renderHook } from '@testing-library/react';
import useStickyBottom from './useStickyBottom';

type FakeContainer = HTMLElement & { scrollHeight: number; clientHeight: number; scrollTop: number };

function createContainer(overrides: Partial<Pick<FakeContainer, 'scrollHeight' | 'clientHeight' | 'scrollTop'>> = {}) {
  const container = document.createElement('div') as FakeContainer;
  Object.defineProperty(container, 'scrollHeight', { value: overrides.scrollHeight ?? 1000, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: overrides.clientHeight ?? 500, configurable: true });
  Object.defineProperty(container, 'scrollTop', { value: overrides.scrollTop ?? 500, writable: true, configurable: true });

  let scrollListener: (() => void) | null = null;
  jest.spyOn(container, 'addEventListener').mockImplementation((event: string, cb: unknown) => {
    if (event === 'scroll') { scrollListener = cb as () => void; }
  });
  jest.spyOn(container, 'removeEventListener').mockImplementation((event: string) => {
    if (event === 'scroll') { scrollListener = null; }
  });

  return { container, fireScroll: () => scrollListener?.() };
}

// MutationObserver notifies via the microtask queue, so tests await a couple
// of ticks after mutating the DOM to let its callback run.
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('useStickyBottom', () => {
  it('follows content mutations to the end sentinel while streaming and pinned', async () => {
    const { container } = createContainer();
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
    const endRef = { current: end } as RefObject<HTMLElement | null>;

    renderHook(() => useStickyBottom(containerRef, endRef, { active: true, streaming: true, messages: [] }));

    container.appendChild(document.createElement('span'));
    await flushMicrotasks();

    expect(end.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
  });

  it('stops following content mutations once the reader scrolls away from the bottom', async () => {
    const { container, fireScroll } = createContainer({ scrollTop: 500 });
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
    const endRef = { current: end } as RefObject<HTMLElement | null>;

    renderHook(() => useStickyBottom(containerRef, endRef, { active: true, streaming: true, messages: [] }));
    (end.scrollIntoView as jest.Mock).mockClear();

    // Reader scrolls up, away from the bottom
    container.scrollTop = 100;
    fireScroll();

    container.appendChild(document.createElement('span'));
    await flushMicrotasks();

    expect(end.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls the end sentinel into view when new messages arrive while pinned', () => {
    const { container } = createContainer();
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
    const endRef = { current: end } as RefObject<HTMLElement | null>;

    const { rerender } = renderHook(
      ({ messages }) => useStickyBottom(containerRef, endRef, { active: true, streaming: false, messages }),
      { initialProps: { messages: ['a'] } },
    );
    rerender({ messages: ['a', 'b'] });

    expect(end.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
  });

  it('does not scroll on new messages when suspended', () => {
    const { container } = createContainer();
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
    const endRef = { current: end } as RefObject<HTMLElement | null>;

    const { rerender } = renderHook(
      ({ messages }) => useStickyBottom(containerRef, endRef, { active: true, streaming: false, suspend: true, messages }),
      { initialProps: { messages: ['a'] } },
    );
    rerender({ messages: ['a', 'b'] });

    expect(end.scrollIntoView).not.toHaveBeenCalled();
  });

  it('lets a caller unpin the view ahead of a directed scroll so streaming does not fight it', async () => {
    const { container } = createContainer();
    const containerRef = { current: container } as RefObject<HTMLElement | null>;
    const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
    const endRef = { current: end } as RefObject<HTMLElement | null>;

    const { result } = renderHook(() =>
      useStickyBottom(containerRef, endRef, { active: true, streaming: true, messages: [] })
    );
    (end.scrollIntoView as jest.Mock).mockClear();

    result.current.current = false;
    container.appendChild(document.createElement('span'));
    await flushMicrotasks();

    expect(end.scrollIntoView).not.toHaveBeenCalled();
  });

  describe('after a container resize', () => {
    const originalResizeObserver = global.ResizeObserver;
    let resizeCallback: (() => void) | null = null;

    beforeEach(() => {
      resizeCallback = null;
      global.ResizeObserver = class {
        constructor(callback: () => void) {
          resizeCallback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {
          resizeCallback = null;
        }
      } as unknown as typeof ResizeObserver;
    });

    afterEach(() => {
      global.ResizeObserver = originalResizeObserver;
    });

    function renderAtBottom() {
      const { container, fireScroll } = createContainer({ scrollTop: 500 });
      const containerRef = { current: container } as RefObject<HTMLElement | null>;
      const end = { scrollIntoView: jest.fn() } as unknown as HTMLElement;
      const endRef = { current: end } as RefObject<HTMLElement | null>;
      renderHook(() => useStickyBottom(containerRef, endRef, { active: true, streaming: false, messages: [] }));
      (end.scrollIntoView as jest.Mock).mockClear();
      return { container, fireScroll, end };
    }

    it('re-pins to the end sentinel when the reader was at the bottom', () => {
      const { end } = renderAtBottom();
      resizeCallback?.(); // initial notification from observe()
      resizeCallback?.();

      expect(end.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
    });

    it('leaves the view alone once the reader has scrolled up', () => {
      const { container, fireScroll, end } = renderAtBottom();
      resizeCallback?.();
      container.scrollTop = 100;
      fireScroll();
      resizeCallback?.();

      expect(end.scrollIntoView).not.toHaveBeenCalled();
    });

    it('ignores the initial size notification that observe() delivers', () => {
      const { end } = renderAtBottom();
      resizeCallback?.();

      expect(end.scrollIntoView).not.toHaveBeenCalled();
    });

    it('still re-pins when scroll anchoring moved the offset down during the reflow', () => {
      const { container, fireScroll, end } = renderAtBottom();
      resizeCallback?.();
      // The column narrowed: content grew and anchoring pushed scrollTop down, but not
      // to the bottom. That scroll event reaches the hook before the resize notification.
      Object.defineProperty(container, 'scrollHeight', { value: 1500, configurable: true });
      container.scrollTop = 800;
      fireScroll();
      resizeCallback?.();

      expect(end.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'end' });
    });

    it('does not re-pin when the reader scrolled up while the content reflowed', () => {
      const { container, fireScroll, end } = renderAtBottom();
      resizeCallback?.();
      Object.defineProperty(container, 'scrollHeight', { value: 1500, configurable: true });
      container.scrollTop = 300;
      fireScroll();
      resizeCallback?.();

      expect(end.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});

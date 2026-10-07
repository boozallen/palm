import { RefObject, useEffect, useRef } from 'react';

const BOTTOM_THRESHOLD_PX = 4;

const isNearBottom = (el: HTMLElement): boolean =>
  el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;

interface UseStickyBottomOptions {
  active: boolean;
  streaming: boolean;
  suspend?: boolean;
  messages: unknown[];
}

/**
 * Keeps the chat scrolled to the bottom while new content streams in, but stops
 * fighting the reader the moment they scroll away from the bottom themselves.
 * Returns a ref callers can flip to `false` before a directed scroll (e.g. jumping
 * to a cited message) so the streaming loop doesn't yank the view back mid-scroll.
 */
export default function useStickyBottom(
  containerRef: RefObject<HTMLElement | null>,
  endRef: RefObject<HTMLElement | null>,
  { active, streaming, suspend, messages }: UseStickyBottomOptions,
) {
  const pinnedRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) { return; }
    let lastScrollTop = container.scrollTop;
    let lastScrollHeight = container.scrollHeight;
    let lastClientHeight = container.clientHeight;
    const handleScroll = (): void => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const reflowed = scrollHeight !== lastScrollHeight || clientHeight !== lastClientHeight;
      const movedDown = scrollTop > lastScrollTop;
      lastScrollTop = scrollTop;
      lastScrollHeight = scrollHeight;
      lastClientHeight = clientHeight;
      if (isNearBottom(container)) {
        pinnedRef.current = true;
      } else if (!(reflowed && movedDown)) {
        // Moving up, or moving over unchanged content, is the reader leaving the bottom.
        // Moving down while the content reflowed is scroll anchoring holding their place
        // as the text above grows (the column narrowed); the resize observer re-pins.
        pinnedRef.current = false;
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [active, containerRef]);

  // A side panel opening or closing narrows the message column and reflows the text,
  // leaving a reader who was at the bottom stranded above it. Re-pin after a resize,
  // but only if they were pinned before it.
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) { return; }
    // observe() delivers one notification for the current size before any real change.
    let isInitialNotification = true;
    const observer = new ResizeObserver(() => {
      if (isInitialNotification) {
        isInitialNotification = false;
        return;
      }
      if (pinnedRef.current) {
        endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [active, containerRef, endRef]);

  useEffect(() => {
    if (suspend || !pinnedRef.current) { return; }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, suspend]);

  // While a response streams in, each token mutates the DOM directly — follow
  // those mutations instead of polling scrollTop on every animation frame.
  useEffect(() => {
    const container = containerRef.current;
    if (!streaming || !container) { return; }
    const followContent = (): void => {
      if (pinnedRef.current) {
        endRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }
    };
    const observer = new MutationObserver(followContent);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [streaming, containerRef, endRef]);

  return pinnedRef;
}

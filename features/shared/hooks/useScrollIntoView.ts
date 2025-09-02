import { useEffect, RefObject } from 'react';

/**
 * Custom hook to automatically scroll to the bottom of a container when its content changes
 * 
 * @param ref - React ref to the container element that should be scrolled
 * @param dependencies - Array of dependencies that trigger scrolling when changed
 * @param options - Options for the scrollIntoView method
 */

export default function useScrollToIntoView<T extends HTMLElement>(
  ref: RefObject<T | null>,
  dependencies: any[] = [],
  options: ScrollIntoViewOptions = { behavior: 'smooth', block: 'end' }
) {
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView(options);
    }
  }, dependencies);
}

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
      
      // Auto-focus message input after scroll
      const timeout = setTimeout(() => {
        const messageInput = document.querySelector('[data-testid="chat-input-textarea"]') as HTMLTextAreaElement;
        if (messageInput && !messageInput.disabled) {
          messageInput.focus();
        }
      }, options.behavior === 'smooth' ? 300 : 0);
      
      return () => clearTimeout(timeout);
    }
  }, dependencies);
}

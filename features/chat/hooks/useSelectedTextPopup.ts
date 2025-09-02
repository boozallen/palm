import { useState, useEffect, useRef, useCallback } from 'react';

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 300;

interface UseSelectedTextOptions {
  // References container where text has been selected
  containerRef?: React.RefObject<HTMLDivElement | null>;
  // References Popover.Target above the selection location
  targetRef?: React.RefObject<HTMLDivElement | null>;
  onSelectionChange?: (text: string, position: { x: number; y: number }) => void;
  onSelectionClear?: () => void;
}

interface UseSelectedTextReturn {
  selectedText: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  closeSelectedTextPopup: () => void;
}

export default function useSelectedTextPopup({
  containerRef: externalContainerRef,
  targetRef,
  onSelectionChange,
  onSelectionClear,
}: UseSelectedTextOptions = {}): UseSelectedTextReturn {
  const [selectedText, setSelectedText] = useState('');
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = externalContainerRef || internalContainerRef;
  const debounceTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const isSelectionWithinContainer = useCallback((selection: Selection): boolean => {
    if (!containerRef.current || !selection.rangeCount) {
      return false;
    }

    const range = selection.getRangeAt(0);
    const container = containerRef.current;

    // Check if the selection is entirely within our container
    return container.contains(range.commonAncestorContainer);
  }, []);

  const isValidSelection = useCallback((text: string, selection: Selection): boolean => {
    if (!text || !text.trim() || text.length < MIN_LENGTH) {
      return false;
    }

    // Skip selections from interactive elements
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer as Element
        : range.startContainer.parentElement;

      if (startElement) {
        const interactiveSelectors = 'button, input, textarea, select, a, [contenteditable]';
        if (startElement.closest(interactiveSelectors)) {
          return false;
        }
      }
    }

    return true;
  }, []);

  const updateTargetPosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !targetRef?.current) {
      return { x: 0, y: 0 };
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    const newPosition = {
      x: rect.left + rect.width / 2,
      y: rect.top,
    };

    targetRef.current.style.left = `${newPosition.x}px`;
    targetRef.current.style.top = `${newPosition.y}px`;
    return newPosition;
  }, [targetRef]);

  const handleSelectionChange = useCallback(() => {
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Immediately check selection state and clear if needed
    const selection = window.getSelection();
    const currentText = selection ? selection.toString().trim() : '';
    
    // If no selection or invalid selection, clear immediately without debounce
    if (!selection || !isSelectionWithinContainer(selection) || !currentText) {
      if (selectedText.length > 0) {
        setSelectedText('');
        onSelectionClear?.();
      }
      return;
    }

    debounceTimeoutRef.current = setTimeout(() => {
      // Re-check selection in case it changed during debounce
      const latestSelection = window.getSelection();
      if (!latestSelection || !isSelectionWithinContainer(latestSelection)) {
        if (selectedText.length > 0) {
          setSelectedText('');
          onSelectionClear?.();
        }
        return;
      }

      const text = latestSelection.toString().trim();

      if (isValidSelection(text, latestSelection)) {
        setSelectedText(text);
        const currentPosition = updateTargetPosition();
        onSelectionChange?.(text, currentPosition);
      } else if (selectedText.length > 0) {
        setSelectedText('');
        onSelectionClear?.();
      }
    }, DEBOUNCE_MS);
  }, [
    selectedText.length,
    isSelectionWithinContainer,
    isValidSelection,
    updateTargetPosition,
    onSelectionChange,
    onSelectionClear,
  ]);

  const closeSelectedTextPopup = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    setSelectedText('');
    onSelectionClear?.();
  }, [onSelectionClear]);

  const handleScroll = useCallback(() => {
    if (selectedText.length > 0) {
      closeSelectedTextPopup();
    }
  }, [selectedText.length, closeSelectedTextPopup]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // Add event listeners
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('scroll', handleScroll, true);

    // Cleanup function
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('scroll', handleScroll, true);
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [handleSelectionChange, handleScroll]);

  // Clear selection when component unmounts or container changes
  useEffect(() => {
    return () => {
      closeSelectedTextPopup();
    };
  }, [closeSelectedTextPopup]);

  return {
    selectedText,
    containerRef,
    closeSelectedTextPopup,
  };
}

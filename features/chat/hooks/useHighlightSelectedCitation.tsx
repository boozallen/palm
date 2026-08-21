import { useState, useEffect, useRef } from 'react';
import { Text, Mark } from '@mantine/core';

export interface HighlightedCitation {
  documentId: string;
  embeddingId?: string;
  citation: string;
  startPosition?: number;
  endPosition?: number;
}

interface DisplaySource {
  id: string;
  type: 'knowledge-base' | 'document';
  label: string;
  text?: string;
}

interface Document {
  id: string;
  filename: string;
  text?: string;
}

interface UseHighlightSelectedCitationProps {
  highlightedCitation: HighlightedCitation | null;
  userDocuments?: { documents: Document[] };
}

/**
 * Custom hook to manage highlighted citation display and scrolling behavior
 *
 * @param highlightedCitation - The citation to highlight (from ChatProvider)
 * @param userDocuments - User's documents data
 * @returns Object containing display state, ref, and render function
 */
export default function useHighlightSelectedCitation({
  highlightedCitation,
  userDocuments,
}: UseHighlightSelectedCitationProps) {
  const [displaySource, setDisplaySource] = useState<DisplaySource | null>(null);
  const highlightedTextRef = useRef<HTMLSpanElement>(null);

  // Handle highlighted citation from chat - find and display the document
  useEffect(() => {
    if (highlightedCitation && userDocuments?.documents) {
      const document = userDocuments.documents.find(doc => doc.id === highlightedCitation.documentId);

      if (!document) {
        return;
      }

      if (!document.text) {
        return;
      }

      setDisplaySource({
        id: highlightedCitation.documentId,
        type: 'document',
        label: document.filename,
        text: document.text,
      });
    }
  }, [highlightedCitation, userDocuments]);

  // Scroll highlighted text into view
  useEffect(() => {
    if (highlightedCitation && displaySource) {
      // Add a delay to ensure the DOM is rendered and pane is visible
      const scrollTimeout = setTimeout(() => {
        if (highlightedTextRef.current) {
          highlightedTextRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 300); // 300ms delay to allow pane to open and render

      return () => clearTimeout(scrollTimeout);
    }
  }, [highlightedCitation, displaySource]);

  /**
   * Renders text with position-based highlighting
   * @param text - The full document text to render
   * @returns JSX element with highlighted text
   */
  const renderHighlightedText = (text: string) => {
    // Check if we have valid highlighting data
    if (!highlightedCitation) {
      return (
        <Text
          size='sm'
          color='gray.5'
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
          }}
        >
          {text}
        </Text>
      );
    }

    if (typeof highlightedCitation.startPosition !== 'number') {
      return (
        <Text
          size='sm'
          color='gray.5'
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
          }}
        >
          {text}
        </Text>
      );
    }

    if (typeof highlightedCitation.endPosition !== 'number') {
      return (
        <Text
          size='sm'
          color='gray.5'
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
          }}
        >
          {text}
        </Text>
      );
    }

    if (highlightedCitation.startPosition < 0) {
      return (
        <Text
          size='sm'
          color='gray.5'
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
          }}
        >
          {text}
        </Text>
      );
    }

    // Clamp positions to valid ranges to handle text normalization differences.
    // When PDFs are processed, the embedded/indexed text may differ slightly from the stored text
    // due to whitespace normalization, encoding conversions, or extraction differences.
    // This primarily affects the last chunk of a document, where the endPosition from the embedding
    // may exceed the actual stored document length by a few characters.
    //
    // Clamping ensures positions stay within valid bounds:
    // - startPosition: Constrained to [0, text.length - 1] to ensure it's within the text
    // - endPosition: Constrained to [startPosition + 1, text.length] to ensure it's after start and within text
    let startPosition = Math.max(0, Math.min(highlightedCitation.startPosition, text.length - 1));
    let endPosition = Math.max(startPosition + 1, Math.min(highlightedCitation.endPosition, text.length));

    if (startPosition >= endPosition) {
      return (
        <Text
          size='sm'
          color='gray.5'
          style={{
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            maxWidth: '100%',
          }}
        >
          {text}
        </Text>
      );
    }

    // Extract the text to highlight based on character positions
    const textToHighlight = text.slice(startPosition, endPosition);

    // Split text into segments for rendering with highlighted portion
    const beforeText = text.slice(0, startPosition);
    const afterText = text.slice(endPosition);

    return (
      <Text
        size='sm'
        color='gray.5'
        component='div'
        style={{
          wordBreak: 'break-word',
          overflowWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          maxWidth: '100%',
        }}
      >
        {beforeText}
        <Mark
          ref={highlightedTextRef}
          color='yellow'
          style={{
            whiteSpace: 'pre-wrap',
          }}
        >
          {textToHighlight}
        </Mark>
        {afterText}
      </Text>
    );
  };

  return {
    displaySource,
    setDisplaySource,
    highlightedTextRef,
    renderHighlightedText,
  };
}

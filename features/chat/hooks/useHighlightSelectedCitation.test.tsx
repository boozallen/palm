import { renderHook } from '@testing-library/react';
import { render } from '@testing-library/react';

import useHighlightSelectedCitation from './useHighlightSelectedCitation';

describe('useHighlightSelectedCitation', () => {
  const mockDocument = {
    id: 'doc-1',
    filename: 'test-document.pdf',
    text: 'This is a test document with some content to highlight.',
  };

  const mockUserDocuments = {
    documents: [mockDocument],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with null displaySource', () => {
    const { result } = renderHook(() =>
      useHighlightSelectedCitation({
        highlightedCitation: null,
        userDocuments: mockUserDocuments,
      })
    );

    expect(result.current.displaySource).toBeNull();
  });

  it('should set displaySource when highlightedCitation is provided', () => {
    const highlightedCitation = {
      documentId: 'doc-1',
      citation: 'test citation',
      startPosition: 10,
      endPosition: 20,
    };

    const { result } = renderHook(() =>
      useHighlightSelectedCitation({
        highlightedCitation,
        userDocuments: mockUserDocuments,
      })
    );

    expect(result.current.displaySource).toEqual({
      id: 'doc-1',
      type: 'document',
      label: 'test-document.pdf',
      text: mockDocument.text,
    });
  });

  it('should not set displaySource when document is not found', () => {
    const highlightedCitation = {
      documentId: 'non-existent-doc',
      citation: 'test citation',
    };

    const { result } = renderHook(() =>
      useHighlightSelectedCitation({
        highlightedCitation,
        userDocuments: mockUserDocuments,
      })
    );

    expect(result.current.displaySource).toBeNull();
  });

  it('should set displaySource when the document has no list text (fetched lazily elsewhere)', () => {
    const documentWithoutText = {
      id: 'doc-2',
      filename: 'no-text.pdf',
    };

    const highlightedCitation = {
      documentId: 'doc-2',
      citation: 'test citation',
    };
    const userDocuments = { documents: [documentWithoutText] };

    const { result } = renderHook(() =>
      useHighlightSelectedCitation({
        highlightedCitation,
        userDocuments,
      })
    );

    expect(result.current.displaySource).toEqual({
      id: 'doc-2',
      type: 'document',
      label: 'no-text.pdf',
      text: undefined,
    });
  });

  it('should update displaySource when highlightedCitation changes', () => {
    const mockDocument2 = {
      id: 'doc-2',
      filename: 'second-document.pdf',
      text: 'Second document content.',
    };

    const { result, rerender } = renderHook(
      ({ highlightedCitation, userDocuments }) =>
        useHighlightSelectedCitation({ highlightedCitation, userDocuments }),
      {
        initialProps: {
          highlightedCitation: {
            documentId: 'doc-1',
            citation: 'first citation',
          },
          userDocuments: { documents: [mockDocument, mockDocument2] },
        },
      }
    );

    expect(result.current.displaySource?.id).toBe('doc-1');

    rerender({
      highlightedCitation: {
        documentId: 'doc-2',
        citation: 'second citation',
      },
      userDocuments: { documents: [mockDocument, mockDocument2] },
    });

    expect(result.current.displaySource?.id).toBe('doc-2');
  });

  describe('renderHighlightedText', () => {
    it('should render plain text when no highlightedCitation is provided', () => {
      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation: null,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is plain text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      expect(container.querySelector('mark')).toBeNull();
    });

    it('should render plain text when startPosition is undefined', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        endPosition: 20,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is plain text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      expect(container.querySelector('mark')).toBeNull();
    });

    it('should render plain text when endPosition is undefined', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 10,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is plain text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      expect(container.querySelector('mark')).toBeNull();
    });

    it('should render plain text when startPosition is negative', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: -1,
        endPosition: 20,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is plain text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      expect(container.querySelector('mark')).toBeNull();
    });

    it('should clamp endPosition to text length when it exceeds', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 0,
        endPosition: 100,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'Short text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      const mark = container.querySelector('mark');
      expect(mark).toBeTruthy();
      expect(mark?.textContent).toBe(text);
    });

    it('should clamp positions when startPosition >= endPosition', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 15,
        endPosition: 10,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is plain text';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      const mark = container.querySelector('mark');
      expect(mark).toBeTruthy();
      // Should highlight at least 1 character after clamping
      expect(mark?.textContent?.length).toBeGreaterThan(0);
    });

    it('should render highlighted text with valid positions', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 5,
        endPosition: 9,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is a test';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      const mark = container.querySelector('mark');
      expect(mark).toBeTruthy();
      expect(mark?.textContent).toBe('is a');
    });

    it('should render highlighted text at the beginning', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 0,
        endPosition: 4,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is a test';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('This');
    });

    it('should render highlighted text at the end', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 10,
        endPosition: 14,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      const text = 'This is a test';
      const { container } = render(result.current.renderHighlightedText(text));

      expect(container.textContent).toBe(text);
      const mark = container.querySelector('mark');
      expect(mark?.textContent).toBe('test');
    });
  });

  describe('scrolling behavior', () => {
    let scrollIntoViewMock: jest.Mock;

    beforeEach(() => {
      jest.useFakeTimers();
      scrollIntoViewMock = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    });

    afterEach(() => {
      jest.clearAllMocks();
      jest.useRealTimers();
    });

    it('should scroll highlighted text into view after delay', () => {
      const highlightedCitation = {
        documentId: 'doc-1',
        citation: 'test citation',
        startPosition: 5,
        endPosition: 9,
      };

      const { result } = renderHook(() =>
        useHighlightSelectedCitation({
          highlightedCitation,
          userDocuments: mockUserDocuments,
        })
      );

      // Mock the ref with a real element
      const element = document.createElement('span');
      Object.defineProperty(result.current.highlightedTextRef, 'current', {
        writable: true,
        value: element,
      });

      // Fast-forward time to trigger scroll
      jest.advanceTimersByTime(300);

      expect(scrollIntoViewMock).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      });
    });
  });
});

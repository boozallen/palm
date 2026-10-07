import { act, renderHook } from '@testing-library/react';

import useVoiceDictation, { isVoiceDictationSupported } from './useVoiceDictation';

const createMockRecognition = () => ({
  continuous: false,
  interimResults: false,
  lang: '',
  start: jest.fn(),
  stop: jest.fn(),
  abort: jest.fn(),
  onresult: null as ((event: unknown) => void) | null,
  onerror: null as ((event: unknown) => void) | null,
  onend: null as (() => void) | null,
});

type MockRecognition = ReturnType<typeof createMockRecognition>;

let mockRecognitionInstance: MockRecognition;
let MockSpeechRecognition: jest.Mock;

describe('useVoiceDictation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecognitionInstance = createMockRecognition();
    MockSpeechRecognition = jest.fn(() => mockRecognitionInstance);

    Object.defineProperty(window, 'SpeechRecognition', {
      value: MockSpeechRecognition,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'SpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'webkitSpeechRecognition', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  describe('isVoiceDictationSupported', () => {
    it('returns true when SpeechRecognition is available', () => {
      expect(isVoiceDictationSupported()).toBe(true);
    });

    it('returns true when webkitSpeechRecognition is available', () => {
      Object.defineProperty(window, 'SpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: MockSpeechRecognition,
        writable: true,
        configurable: true,
      });

      expect(isVoiceDictationSupported()).toBe(true);
    });

    it('returns false when neither API is available', () => {
      Object.defineProperty(window, 'SpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isVoiceDictationSupported()).toBe(false);
    });
  });

  describe('initial state', () => {
    it('starts with isListening false', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      expect(result.current.isListening).toBe(false);
    });

    it('reports isSupported correctly', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      expect(result.current.isSupported).toBe(true);
    });
  });

  describe('toggle', () => {
    it('starts listening when toggled on', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(true);
      expect(mockRecognitionInstance.start).toHaveBeenCalledTimes(1);
    });

    it('stops listening when toggled off', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(false);
      expect(mockRecognitionInstance.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('recognition configuration', () => {
    it('sets continuous mode and correct language', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() =>
        useVoiceDictation({ onTranscript, lang: 'fr-FR' }),
      );

      act(() => {
        result.current.toggle();
      });

      expect(mockRecognitionInstance.continuous).toBe(true);
      expect(mockRecognitionInstance.interimResults).toBe(false);
      expect(mockRecognitionInstance.lang).toBe('fr-FR');
    });

    it('defaults to en-US language', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(mockRecognitionInstance.lang).toBe('en-US');
    });
  });

  describe('transcript handling', () => {
    it('calls onTranscript with final results', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: true,
            0: { transcript: 'hello world' },
            length: 1,
          },
        },
      };

      act(() => {
        mockRecognitionInstance.onresult?.(mockEvent);
      });

      expect(onTranscript).toHaveBeenCalledWith('hello world');
    });

    it('does not call onTranscript for non-final results', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      const mockEvent = {
        resultIndex: 0,
        results: {
          length: 1,
          0: {
            isFinal: false,
            0: { transcript: 'partial' },
            length: 1,
          },
        },
      };

      act(() => {
        mockRecognitionInstance.onresult?.(mockEvent);
      });

      expect(onTranscript).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('sets isListening to false on error', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(true);

      act(() => {
        mockRecognitionInstance.onerror?.({ error: 'not-allowed' });
      });

      expect(result.current.isListening).toBe(false);
    });

    it('sets isListening to false on end', () => {
      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(true);

      act(() => {
        mockRecognitionInstance.onend?.();
      });

      expect(result.current.isListening).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('aborts recognition on unmount', () => {
      const onTranscript = jest.fn();
      const { result, unmount } = renderHook(() =>
        useVoiceDictation({ onTranscript }),
      );

      act(() => {
        result.current.toggle();
      });

      unmount();

      expect(mockRecognitionInstance.abort).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsupported browser', () => {
    it('does nothing when toggled in unsupported browser', () => {
      Object.defineProperty(window, 'SpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(window, 'webkitSpeechRecognition', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const onTranscript = jest.fn();
      const { result } = renderHook(() => useVoiceDictation({ onTranscript }));

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isListening).toBe(false);
      expect(result.current.isSupported).toBe(false);
    });
  });
});

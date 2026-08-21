import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import ChatVoiceDictationButton from './ChatVoiceDictationButton';
import * as useVoiceDictationModule from '@/features/chat/hooks/useVoiceDictation';

jest.mock('@/features/chat/hooks/useVoiceDictation');

const mockToggle = jest.fn();

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('ChatVoiceDictationButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useVoiceDictationModule.default as jest.Mock).mockReturnValue({
      isListening: false,
      isSupported: true,
      toggle: mockToggle,
    });

    (useVoiceDictationModule.isVoiceDictationSupported as jest.Mock).mockReturnValue(true);
  });

  it('renders the button when voice dictation is supported', () => {
    render(<ChatVoiceDictationButton onTranscript={jest.fn()} />);

    const button = screen.getByTestId('chat-voice-dictation-button');
    expect(button).toBeInTheDocument();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render when voice dictation is not supported', () => {
    (useVoiceDictationModule.isVoiceDictationSupported as jest.Mock).mockReturnValue(false);

    render(<ChatVoiceDictationButton onTranscript={jest.fn()} />);

    expect(screen.queryByTestId('chat-voice-dictation-button')).not.toBeInTheDocument();
  });

  it('calls toggle when clicked', () => {
    render(<ChatVoiceDictationButton onTranscript={jest.fn()} />);

    const button = screen.getByTestId('chat-voice-dictation-button');
    fireEvent.click(button);

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it('renders with default styling when not listening', () => {
    render(<ChatVoiceDictationButton onTranscript={jest.fn()} />);

    const button = screen.getByTestId('chat-voice-dictation-button');
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('renders with active styling when listening', () => {
    (useVoiceDictationModule.default as jest.Mock).mockReturnValue({
      isListening: true,
      isSupported: true,
      toggle: mockToggle,
    });

    render(<ChatVoiceDictationButton onTranscript={jest.fn()} />);

    const button = screen.getByTestId('chat-voice-dictation-button');
    expect(button).toBeInTheDocument();
    expect(button).toBeEnabled();
  });

  it('passes onTranscript to the hook', () => {
    const onTranscript = jest.fn();
    render(<ChatVoiceDictationButton onTranscript={onTranscript} />);

    expect(useVoiceDictationModule.default).toHaveBeenCalledWith({
      onTranscript,
    });
  });
});

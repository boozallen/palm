import { act, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { useRef } from 'react';

import SelectedTextPopup from './SelectedTextPopup';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useSelectedTextPopup from '@/features/chat/hooks/useSelectedTextPopup';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import {
  AuditRecordEvent,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/hooks/useSelectedTextPopup', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseChat = useChat as jest.Mock;
const mockedUseSelectedTextPopup = useSelectedTextPopup as jest.Mock;

const CHAT_ID = 'a2bb6c78-4e69-4c14-8e21-6ba6b1a4dbb6';
const MESSAGE_ID = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';

const renderWithMantine = (component: React.ReactElement) => {
  return render(
    <MantineProvider withGlobalStyles withNormalizeCSS>
      {component}
    </MantineProvider>
  );
};

function TestWrapper() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div ref={containerRef}>Test container</div>
      <SelectedTextPopup containerRef={containerRef} messageId={MESSAGE_ID} />
    </div>
  );
}

describe('SelectedTextPopup', () => {
  const mockSetSelectedText = jest.fn();
  const mockCloseSelectedTextPopup = jest.fn();
  const mockCreateAuditRecord = jest.fn();

  // The hook owns the DOM selection listeners, so the tests drive its callbacks
  // directly to stand in for a user dragging across a response.
  let selectionCallbacks: {
    onSelectionChange?: (text: string, position: { x: number; y: number }) => void;
    onSelectionClear?: () => void;
  } = {};

  const setSelection = (selectedText: string) => {
    mockedUseSelectedTextPopup.mockImplementation((options) => {
      selectionCallbacks = options ?? {};
      return { selectedText, closeSelectedTextPopup: mockCloseSelectedTextPopup };
    });
  };

  const highlight = (text: string) => {
    act(() => {
      selectionCallbacks.onSelectionChange?.(text, { x: 0, y: 0 });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    selectionCallbacks = {};
    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
      chatId: CHAT_ID,
    });
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({
      mutate: mockCreateAuditRecord,
    });
    setSelection('');
  });

  it('renders nothing when no text is selected', () => {
    renderWithMantine(<TestWrapper />);

    expect(screen.queryByText(/ask palm/i)).not.toBeInTheDocument();
  });

  it('renders the "Ask Palm" button when text is selected', () => {
    setSelection('selected text');

    renderWithMantine(<TestWrapper />);

    expect(screen.getByText(/ask palm/i)).toBeInTheDocument();
  });

  it('calls setSelectedText and closeSelectedTextPopup when the button is clicked', () => {
    setSelection('selected text');

    renderWithMantine(<TestWrapper />);

    const selectedTextPopupButton = screen.getByText(/ask palm/i);
    fireEvent.click(selectedTextPopupButton);

    expect(mockSetSelectedText).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedText).toHaveBeenCalledWith('selected text');
    expect(mockCloseSelectedTextPopup).toHaveBeenCalledTimes(1);
  });

  describe('audit records', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('records a highlight once the selection settles', () => {
      renderWithMantine(<TestWrapper />);

      highlight('a highlighted sentence');
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.HighlightResponseText,
        label: '22 characters of a chat response',
        metadata: {
          resourceType: AuditRecordResourceType.ChatMessage,
          resourceIds: [MESSAGE_ID],
          chatMessageId: MESSAGE_ID,
          chatId: CHAT_ID,
        },
      });
    });

    // A drag reports a growing selection the whole way across a paragraph. Each
    // report used to be a record, turning one highlight into a burst of partial
    // ones.
    it('records one record for a drag that grows the selection', () => {
      renderWithMantine(<TestWrapper />);

      highlight('a');
      highlight('a high');
      highlight('a highlighted sentence');
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
      expect(mockCreateAuditRecord.mock.calls[0][0].label)
        .toBe('22 characters of a chat response');
    });

    it('records nothing while the selection is still moving', () => {
      renderWithMantine(<TestWrapper />);

      highlight('a highlighted sentence');
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(mockCreateAuditRecord).not.toHaveBeenCalled();
    });

    // Clicking "Ask Palm" clears the selection, and that is the highlight most
    // worth a record — so a cleared selection flushes rather than drops.
    it('records a pending highlight when the selection is cleared', () => {
      renderWithMantine(<TestWrapper />);

      highlight('a highlighted sentence');
      act(() => {
        selectionCallbacks.onSelectionClear?.();
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
    });

    it('records nothing when a cleared selection was already recorded', () => {
      renderWithMantine(<TestWrapper />);

      highlight('a highlighted sentence');
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      act(() => {
        selectionCallbacks.onSelectionClear?.();
      });

      expect(mockCreateAuditRecord).toHaveBeenCalledTimes(1);
    });

    it('never puts the highlighted text in the record', () => {
      renderWithMantine(<TestWrapper />);

      highlight('patient SSN 123-45-6789');
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(JSON.stringify(mockCreateAuditRecord.mock.calls)).not.toContain('123-45-6789');
    });
  });
});

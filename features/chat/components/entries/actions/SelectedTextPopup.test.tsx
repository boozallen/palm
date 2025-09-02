import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { useRef } from 'react';

import SelectedTextPopup from './SelectedTextPopup';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useSelectedTextPopup from '@/features/chat/hooks/useSelectedTextPopup';

jest.mock('@/features/chat/providers/ChatProvider', () => ({
  useChat: jest.fn(),
}));

jest.mock('@/features/chat/hooks/useSelectedTextPopup', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockedUseChat = useChat as jest.Mock;
const mockedUseSelectedTextPopup = useSelectedTextPopup as jest.Mock;

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
      <SelectedTextPopup containerRef={containerRef} />
    </div>
  );
}

describe('SelectedTextPopup', () => {
  const mockSetSelectedText = jest.fn();
  const mockCloseSelectedTextPopup = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseChat.mockReturnValue({
      setSelectedText: mockSetSelectedText,
    });
  });

  it('renders nothing when no text is selected', () => {
    mockedUseSelectedTextPopup.mockReturnValue({
      selectedText: '',
      closeSelectedTextPopup: mockCloseSelectedTextPopup,
    });

    renderWithMantine(<TestWrapper />);

    expect(screen.queryByText(/ask palm/i)).not.toBeInTheDocument();
  });

  it('renders the "Ask Palm" button when text is selected', () => {
    mockedUseSelectedTextPopup.mockReturnValue({
      selectedText: 'selected text',
      closeSelectedTextPopup: mockCloseSelectedTextPopup,
    });

    renderWithMantine(<TestWrapper />);

    expect(screen.getByText(/ask palm/i)).toBeInTheDocument();
  });

  it('calls setSelectedText and closeSelectedTextPopup when the button is clicked', () => {
    mockedUseSelectedTextPopup.mockReturnValue({
      selectedText: 'selected text',
      closeSelectedTextPopup: mockCloseSelectedTextPopup,
    });

    renderWithMantine(<TestWrapper />);

    const selectedTextPopupButton = screen.getByText(/ask palm/i);
    fireEvent.click(selectedTextPopupButton);

    expect(mockSetSelectedText).toHaveBeenCalledTimes(1);
    expect(mockSetSelectedText).toHaveBeenCalledWith('selected text');
    expect(mockCloseSelectedTextPopup).toHaveBeenCalledTimes(1);
  });
});

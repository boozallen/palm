import { render, screen, fireEvent } from '@testing-library/react';
import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useRouter } from 'next/router';
import useGetHasOpenAiModel from '@/features/shared/api/get-has-openai-model';

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/shared/api/get-has-openai-model');
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockGetHasOpenAiModel = (useGetHasOpenAiModel as jest.Mock);

const setHasOpenAiModel = (value: boolean, isLoading: boolean) => {
  mockGetHasOpenAiModel.mockReturnValue({
    data: value,
    isPending: isLoading,
  });
};

describe('ChatDocumentLibraryInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    setHasOpenAiModel(true, false);
  });

  it('renders checkbox', () => {
    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: false,
      setDocumentLibraryEnabled: jest.fn(),
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: undefined },
    });

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByTestId('chat-document-library-input');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('toggles checkbox state when clicked', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: false,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: undefined },
    });

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByTestId('chat-document-library-input');
    fireEvent.click(checkbox);
    expect(setDocumentLibraryEnabledMock).toHaveBeenCalledWith(true);
  });

  it('sets checkbox state based on router query', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: true,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: 'true' },
    });

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByTestId('chat-document-library-input');
    expect(checkbox).toBeChecked();
  });

  it('disables checkbox if no openai provider available', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: false,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    setHasOpenAiModel(false, false);

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByLabelText(/use document library/i);
    expect(checkbox).toBeDisabled();
  });

  it('sets documentLibraryEnabled to false if no openai provider available', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: true,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    setHasOpenAiModel(false, false);

    render(<ChatDocumentLibraryInput />);

    expect(setDocumentLibraryEnabledMock).toHaveBeenCalledWith(false);
  });
});

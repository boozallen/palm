import { render, screen, fireEvent } from '@testing-library/react';
import ChatDocumentLibraryInput from './ChatDocumentLibraryInput';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useRouter } from 'next/router';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/shared/api/document-upload/get-document-upload-requirements');
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockGetDocumentUploadRequirements = (useGetDocumentUploadRequirements as jest.Mock);

const setDocumentUploadRequirements = (configured: boolean, isLoading: boolean) => {
  mockGetDocumentUploadRequirements.mockReturnValue({
    data: {
      configured,
      requirements: [
        {
          name: 'Redis Instance',
          available: configured,
        },
      ],
    },
    isPending: isLoading,
  });
};

describe('ChatDocumentLibraryInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDocumentUploadRequirements(true, false);
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

  it('disables checkbox if document upload requirements not configured', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: false,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: undefined },
    });

    setDocumentUploadRequirements(false, false);

    render(<ChatDocumentLibraryInput />);
    const checkbox = screen.getByLabelText(/use document library/i);
    expect(checkbox).toBeDisabled();
  });

  it('sets documentLibraryEnabled to false if document upload requirements not configured', () => {
    const setDocumentLibraryEnabledMock = jest.fn();

    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: true,
      setDocumentLibraryEnabled: setDocumentLibraryEnabledMock,
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: undefined },
    });

    setDocumentUploadRequirements(false, false);

    render(<ChatDocumentLibraryInput />);
    expect(setDocumentLibraryEnabledMock).toHaveBeenCalledWith(false);
  });

  it('shows loading state when requirements are loading', () => {
    (useChat as jest.Mock).mockReturnValue({
      documentLibraryEnabled: false,
      setDocumentLibraryEnabled: jest.fn(),
    });

    (useRouter as jest.Mock).mockReturnValue({
      query: { document_library: undefined },
    });

    setDocumentUploadRequirements(true, true);

    render(<ChatDocumentLibraryInput />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});

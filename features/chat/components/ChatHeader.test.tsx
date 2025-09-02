import { render, screen } from '@testing-library/react';
import ChatHeader from './ChatHeader';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

jest.mock('./ChatModelSelect', () => {
  return function ChatModelSelect() {
    return <div data-testid='chat-model-select'></div>;
  };
});

jest.mock('./ChatKnowledgeBasesSelect', () => {
  return function ChatKnowledgeBasesSelect() {
    return <div data-testid='chat-knowledge-bases-select'></div>;
  };
});

jest.mock('./ChatDocumentLibraryInput', () => {
  return function ChatDocumentLibraryInput() {
    return <div data-testid='chat-document-library-input'></div>;
  };
});

const mockUseGetSystemConfig = useGetSystemConfig as jest.Mock;

describe('ChatHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all child components when documentLibraryDocumentUploadProviderId is set', async () => {
    mockUseGetSystemConfig.mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'some-test-id',
      },
      isPending: false,
    });

    render(<ChatHeader />);

    const chatModelSelect = screen.getByTestId('chat-model-select');
    const chatKnowledgeBasesSelect = screen.getByTestId('chat-knowledge-bases-select');
    const chatDocumentLibraryInput = screen.getByTestId('chat-document-library-input');

    expect(chatModelSelect).toBeInTheDocument();
    expect(chatKnowledgeBasesSelect).toBeInTheDocument();
    expect(chatDocumentLibraryInput).toBeInTheDocument();
  });

  it('hides ChatDocumentLibraryInput when documentLibraryDocumentUploadProviderId is not set', async () => {
    mockUseGetSystemConfig.mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: null,
      },
      isPending: false,
    });

    render(<ChatHeader />);

    const chatModelSelect = screen.getByTestId('chat-model-select');
    const chatKnowledgeBasesSelect = screen.getByTestId('chat-knowledge-bases-select');
    const chatDocumentLibraryInput = screen.queryByTestId('chat-document-library-input');

    expect(chatModelSelect).toBeInTheDocument();
    expect(chatKnowledgeBasesSelect).toBeInTheDocument();
    expect(chatDocumentLibraryInput).not.toBeInTheDocument();
  });

  it('displays loading component if system config is loading', () => {
    mockUseGetSystemConfig.mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<ChatHeader />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import ChatInterface from './ChatInterface';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import useGetMessages from '@/features/chat/api/get-messages';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

type ChatProviderProps = {
  children: React.ReactNode;
  chatId?: string | null;
  promptId?: string | null;
  modelId?: string | null;
};

jest.mock('@/components/layouts/ChatLayout/ChatLayout', () => {
  return jest.fn(({ children }) => {
    return (
      <>
        <p>Chat Layout</p>
        <div>{children}</div>
      </>
    );
  });
});

let capturedProps: any = {};

jest.mock('@/features/chat/providers/ChatProvider', () => {
  const mockChatProvider = jest.fn(({ children, ...props }: ChatProviderProps) => {
    capturedProps = { ...props };

    return (
      <>
        <p>Chat Provider</p>
        <div>{children}</div>
      </>
    );
  });

  return {
    ChatProvider: mockChatProvider,
    useChat: () => ({
      selectedArtifact: null,
      setSelectedArtifact: jest.fn(),
      chatId: capturedProps.chatId || null,
      setChatId: jest.fn(),
      promptId: null,
      setPromptId: jest.fn(),
      pendingMessage: null,
      setPendingMessage: jest.fn(),
      modelId: null,
      setModelId: jest.fn(),
      isLastMessageRetry: false,
      setIsLastMessageRetry: jest.fn(),
      knowledgeBaseIds: [],
      setKnowledgeBaseIds: jest.fn(),
      showKnowledgeGraph: false,
      setShowKnowledgeGraph: jest.fn(),
      selectedDocumentIds: [],
      documentNameMap: {},
      enumerationTabs: [],
      setEnumerationTabs: jest.fn(),
      activeEnumerationTabId: null,
      setActiveEnumerationTabId: jest.fn(),
      removeTab: jest.fn(),
      graphEntityIds: [],
      setGraphEntityIds: jest.fn(),
      addToGraph: jest.fn(),
      removeFromGraph: jest.fn(),
      useGraph: false,
      setGraphCanvasSelectedEntityIds: jest.fn(),
      setGraphDisplayedEntityIds: jest.fn(),
      setHighlightedCitation: jest.fn(),
      setSourcesSidebarExpanded: jest.fn(),
      graphCitationPin: null,
      restoreEvidence: jest.fn(),
      graphHistoryPanelOpen: false,
      selectedGraphSnapshotId: null,
      openGraphHistory: jest.fn(),
      closeGraphHistory: jest.fn(),
      activeEvidenceMessageId: null,
      setActiveEvidenceMessageId: jest.fn(),
      showArtifactsContainer: false,
    }),
  };
});

jest.mock('./ChatContent', () => {
  return jest.fn(() => {
    return <p>Chat Content</p>;
  });
});

jest.mock('./ChatInput', () => {
  return jest.fn(() => {
    return <p>Chat Input</p>;
  });
});

jest.mock('./EmptyChatSuggestions', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  ChatGreeting: jest.fn(() => null),
  ChatEmptySuggestions: jest.fn(() => null),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn().mockReturnValue({ data: null }),
}));

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({ push: jest.fn() }),
}));

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-user-knowledge-bases');
jest.mock('@/features/shared/api/get-bedrock-model-access');
jest.mock('@/features/chat/api/get-messages');
jest.mock('@/features/shared/api/get-available-models');

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = {};
    
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'test-provider-id',
      },
      isPending: false,
    });
    
    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: { userKnowledgeBases: [] },
      isPending: false,
      error: null,
    });
    
    (useGetBedrockModelAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: false },
      isPending: false,
      error: null,
    });

    (useGetMessages as jest.Mock).mockReturnValue({
      data: { messages: [] },
      isPending: false,
      error: null,
    });

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: { models: [] },
      isPending: false,
    });
  });

  it('renders children components', () => {
    render(<ChatInterface />);

    const chatLayout = screen.getByText('Chat Layout');
    const chatProvider = screen.getByText('Chat Provider');
    const chatContent = screen.getByText('Chat Content');
    const chatInput = screen.getByText('Chat Input');

    expect(chatLayout).toBeInTheDocument();
    expect(chatProvider).toBeInTheDocument();
    expect(chatContent).toBeInTheDocument();
    expect(chatInput).toBeInTheDocument();
  });

  it('passes all props to ChatProvider', () => {
    render(
      <ChatInterface chatId='chatId' promptId='promptId' modelId='modelId' />
    );

    expect(ChatProvider).toHaveBeenCalled();
    
    expect(capturedProps).toEqual(
      expect.objectContaining({
        chatId: 'chatId',
        promptId: 'promptId',
        modelId: 'modelId',
      })
    );
  });

  it('passes correct props to ChatProvider', () => {
    render(<ChatInterface chatId='chatId' modelId='modelId' />);

    expect(ChatProvider).toHaveBeenCalled();

    expect(capturedProps).toEqual(
      expect.objectContaining({
        chatId: 'chatId',
        modelId: 'modelId',
      })
    );

    if ('promptId' in capturedProps) {
      expect([null, undefined]).toContain(capturedProps.promptId);
    }
  });

});

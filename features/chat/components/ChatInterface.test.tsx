import { render, screen } from '@testing-library/react';
import ChatInterface from './ChatInterface';
import { ChatProvider } from '@/features/chat/providers/ChatProvider';

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

let capturedProps = {};

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
      chatId: null,
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
    }),
  };
});

jest.mock('./ChatHeader', () => {
  return jest.fn(() => {
    return <p>Chat Header</p>;
  });
});

jest.mock('./ChatContent', () => {
  return jest.fn(() => {
    return <p>Chat Content</p>;
  });
});

jest.mock('./ChatFooter', () => {
  return jest.fn(() => {
    return <p>Chat Footer</p>;
  });
});

describe('ChatInterface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedProps = {};
  });

  it('renders children components', () => {
    render(<ChatInterface />);

    const chatLayout = screen.getByText('Chat Layout');
    const chatProvider = screen.getByText('Chat Provider');
    const chatHeader = screen.getByText('Chat Header');
    const chatContent = screen.getByText('Chat Content');
    const chatFooter = screen.getByText('Chat Footer');

    expect(chatLayout).toBeInTheDocument();
    expect(chatProvider).toBeInTheDocument();
    expect(chatHeader).toBeInTheDocument();
    expect(chatContent).toBeInTheDocument();
    expect(chatFooter).toBeInTheDocument();
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

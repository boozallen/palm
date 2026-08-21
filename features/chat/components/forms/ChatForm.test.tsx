import { fireEvent, waitFor, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import { notifications } from '@mantine/notifications';

import ChatForm from './ChatForm';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useCreateChat from '@/features/chat/api/create-chat';
import useAddMessage from '@/features/chat/api/add-message';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import { renderWrapper } from '@/test/test-utils';
import { usePiiDetection } from '@/features/shared/hooks/piiDetection/usePiiDetection';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import useGetMessages from '@/features/chat/api/get-messages';
import { AsyncChatStatus } from '@/features/chat/types/message';
import { UiPreference } from '@/types/ui-preferences';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));
jest.mock('@mantine/notifications');

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/chat/api/create-chat');
jest.mock('@/features/chat/api/add-message');
jest.mock('@/features/chat/api/get-origin-prompt');
jest.mock('@/features/chat/api/update-chat-conversation-summary');
jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/shared/hooks/piiDetection/usePiiDetection', () => ({
  usePiiDetection: jest.fn(),
}));

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-bedrock-model-access');
jest.mock('@/features/shared/api/get-user-knowledge-bases');
jest.mock('@/features/chat/api/get-messages');

jest.mock('../ChatModelSelect', () => {
  return function ChatModelSelect() {
    return <div data-testid='chat-model-select'></div>;
  };
});

jest.mock('../ChatDeepResearchButton', () => {
  return function ChatDeepResearchButton() {
    return <div data-testid='chat-deep-research-button'></div>;
  };
});

describe('ChatForm', () => {
  const mockUseChat = {
    chatId: null,
    modelId: 'b6185671-e27f-4f69-8647-987176d96e66',
    promptId: '1f68f2a6-71f3-4ff5-8501-ecf15847c055',
    setChatId: jest.fn(),
    pendingMessage: null,
    setPendingMessage: jest.fn(),
    isLastMessageRetry: false,
    knowledgeBaseIds: [],
    documentIds: [],
    deepResearchEnabled: false,
    setDeepResearchEnabled: jest.fn(),
    systemMessage: null,
    selectedText: null,
    setSelectedText: jest.fn(),
    selectedArtifact: null,
    sourcesSidebarExpanded: false,
    setSourcesSidebarExpanded: jest.fn(),
    useGraph: false,
    setUseGraph: jest.fn(),
    showGraphTooltip: false,
    graphedSourceIds: [],
    setHasUserSubmittedMessageInSession: jest.fn(),
    enumerationTabs: [],
    activeEnumerationTabId: null,
    setActiveEnumerationTabId: jest.fn(),
    removeTab: jest.fn(),
    graphEntityIds: [],
    setGraphEntityIds: jest.fn(),
    addToGraph: jest.fn(),
    removeFromGraph: jest.fn(),
    queryScope: 'document',
    setQueryScope: jest.fn(),
    graphCanvasSelectedEntityIds: [],
    graphDisplayedEntityIds: [],
    setGraphCanvasSelectedEntityIds: jest.fn(),
    setGraphDisplayedEntityIds: jest.fn(),
    showKnowledgeGraph: false,
    setShowKnowledgeGraph: jest.fn(),
    selectedDocumentIds: [],
    documentNameMap: {},
    setHighlightedCitation: jest.fn(),
    prefilledMessage: null,
    setPrefilledMessage: jest.fn(),
    autoSubmitMessage: null,
    setAutoSubmitMessage: jest.fn(),
    triggerAddSource: false,
    setTriggerAddSource: jest.fn(),
    triggerEditSystemPrompt: false,
    setTriggerEditSystemPrompt: jest.fn(),
    setHasUserInteracted: jest.fn(),
    setMessageInputHasText: jest.fn(),
  };

  const mockChatId = '22acee37-f309-41e5-a7a9-5e1abc6c4587';
  const mockAvailableModelId = 'ceb3104c-a1a1-4ce0-b433-a3cfdc1be7bf';
  const mockPromptExample = 'example input';
  const mockMessage = 'test message';

  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
    },
  };

  const mockPiiDetection = () => {
    (usePiiDetection as jest.Mock).mockReturnValue({
      submitWithPiiCheck: jest.fn((message, callback) => callback()),
      isModalOpen: false,
      detectedPii: [],
      onContinue: jest.fn(),
      onClose: jest.fn(),
      isProcessing: false,
    });
  };

  const mockUseGetSystemConfig = useGetSystemConfig as jest.Mock;
  const mockUseGetBedrockModelAccess = useGetBedrockModelAccess as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Mark the Start Here guide as seen so it doesn't auto-expand over the input.
    localStorage.setItem(UiPreference.START_HERE_GUIDE_SEEN, 'true');
    mockPiiDetection();
    (useChat as jest.Mock).mockReturnValue(mockUseChat);
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({ chat: { id: mockChatId } }),
      isPending: false,
    });
    (useAddMessage as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue({}),
      isPending: false,
    });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isPending: false,
      isFetched: true,
      data: { prompt: { example: mockPromptExample } },
    });
    (useUpdateChatConversationSummary as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: {
        availableModels: [{
          id: 'ceb3104c-a1a1-4ce0-b433-a3cfdc1be7bf',
          name: 'model-name',
        }],
      },
      isPending: false,
    });
    (useGetFeatureFlag as jest.Mock).mockReturnValue({
      data: { isFeatureOn: true },
      isPending: false,
      error: null,
    });
    mockUseGetSystemConfig.mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'some-test-id',
      },
      isPending: false,
    });
    mockUseGetBedrockModelAccess.mockReturnValue({
      data: {
        hasAccess: true,
      },
      isPending: false,
    });
    (useGetUserKnowledgeBases as jest.Mock).mockReturnValue({
      data: {
        userKnowledgeBases: [{ id: '1', name: 'Test KB' }],
      },
      isPending: false,
    });
    (useGetMessages as jest.Mock).mockReturnValue({
      data: { messages: [] },
    });
  });

  it('renders without crashing', () => {
    const { container } = renderWrapper(<ChatForm />);
    expect(container).toBeTruthy();
  });

  it('submits the form and creates a new chat', async () => {
    const { getByRole, getByTestId: _getByTestId } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(useCreateChat().mutateAsync).toHaveBeenCalledWith({
        modelId: mockUseChat.modelId,
        promptId: mockUseChat.promptId,
        systemMessage: mockUseChat.systemMessage,
      });
      expect(useAddMessage().mutateAsync).toHaveBeenCalledWith({
        chatId: mockChatId,
        message: mockMessage,
        knowledgeBaseIds: [],
        documentIds: [],
        deepResearchEnabled: false,
        useGraph: false,
        graphEntityIds: [],
        graphScopeSource: 'document',
      });
      expect(mockUseChat.setChatId).toHaveBeenCalledWith(mockChatId);
    });
  });

  it('sets the prompt example to the text input if there is one', () => {
    const { getByDisplayValue } = renderWrapper(<ChatForm />);
    expect(getByDisplayValue(mockPromptExample)).toBeInTheDocument();
  });

  it('shows a notification if there is an error', async () => {
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn().mockRejectedValue(new Error('Error creating chat')),
      isPending: false,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Failed to Add Message to Chat',
        message: 'An unexpected error occurred. Please try again later.',
        icon: expect.any(Object),
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    });
  });

  it('disables the submit button when pending', () => {
    (useCreateChat as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: true,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const submitButton = getByRole('button', { name: /send/i });

    expect(submitButton).toBeDisabled();
  });

  it('disables the submit button while a response is still being generated', () => {
    (useChat as jest.Mock).mockReturnValue({ ...mockUseChat, chatId: mockChatId });
    (useGetMessages as jest.Mock).mockReturnValue({
      data: { messages: [{ asyncChatStatus: AsyncChatStatus.PROCESSING }] },
    });

    const { getByRole } = renderWrapper(<ChatForm />);

    expect(getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('enables the submit button once the response has completed', async () => {
    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      chatId: mockChatId,
      modelId: mockAvailableModelId,
    });
    (useGetMessages as jest.Mock).mockReturnValue({
      data: { messages: [{ asyncChatStatus: AsyncChatStatus.COMPLETED }] },
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    fireEvent.change(screen.getByTestId('chat-input-textarea'), {
      target: { value: mockMessage },
    });

    await waitFor(() => {
      expect(getByRole('button', { name: /send/i })).not.toBeDisabled();
    });
  });

  it('renders ChatModelSelect component', () => {
    renderWrapper(<ChatForm />);

    const chatModelSelect = screen.getByTestId('chat-model-select');
    expect(chatModelSelect).toBeInTheDocument();
  });

  it('renders ChatDeepResearchButton component', () => {
    renderWrapper(<ChatForm />);

    const deepResearchButton = screen.getByTestId('chat-deep-research-button');
    expect(deepResearchButton).toBeInTheDocument();
  });

  it('renders the Start Here trigger in the empty chat state', () => {
    renderWrapper(<ChatForm />);
    expect(screen.getByTestId('start-here-trigger')).toBeInTheDocument();
  });

  it('does not render the Start Here trigger in an active chat', () => {
    (useChat as jest.Mock).mockReturnValue({ ...mockUseChat, chatId: mockChatId });
    renderWrapper(<ChatForm />);
    expect(screen.queryByTestId('start-here-trigger')).not.toBeInTheDocument();
  });

  it('opens the walkthrough and covers the input when the trigger is clicked', () => {
    renderWrapper(<ChatForm />);

    fireEvent.click(screen.getByTestId('start-here-trigger'));

    expect(screen.getByTestId('start-here-walkthrough')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('closes the walkthrough and restores the input on close', () => {
    renderWrapper(<ChatForm />);

    fireEvent.click(screen.getByTestId('start-here-trigger'));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(screen.queryByTestId('start-here-walkthrough')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('submits the form with agent-provider prefix modelId', async () => {
    const agentProviderId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const agentModelId = `agent-provider::${agentProviderId}`;

    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      modelId: agentModelId,
      promptId: null,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(useCreateChat().mutateAsync).toHaveBeenCalledWith({
        modelId: agentModelId,
        promptId: null,
        systemMessage: mockUseChat.systemMessage,
      });
    });
  });

  it('submits the form with deep research enabled', async () => {
    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      deepResearchEnabled: true,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');
    const submitButton = getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: mockMessage } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(useAddMessage().mutateAsync).toHaveBeenCalledWith({
        chatId: mockChatId,
        message: mockMessage,
        knowledgeBaseIds: [],
        documentIds: [],
        deepResearchEnabled: true,
        useGraph: false,
        graphEntityIds: [],
        graphScopeSource: 'document',
      });
    });
  });

  it('applies prefilled message from empty state', async () => {
    const prefilledText = 'Help me with code: ';

    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      prefilledMessage: prefilledText,
    });

    const { getByRole } = renderWrapper(<ChatForm />);
    const input = getByRole('textbox');

    await waitFor(() => {
      expect(input).toHaveValue(prefilledText);
      expect(mockUseChat.setPrefilledMessage).toHaveBeenCalledWith(null);
    });
  });

  it('auto-submits message from empty state', async () => {
    const autoSubmitText = 'Help me brainstorm ';
    const trimmedAutoSubmitText = 'Help me brainstorm';

    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      autoSubmitMessage: autoSubmitText,
    });

    renderWrapper(<ChatForm />);

    await waitFor(() => {
      expect(mockUseChat.setAutoSubmitMessage).toHaveBeenCalledWith(null);
      expect(useCreateChat().mutateAsync).toHaveBeenCalledWith({
        modelId: mockUseChat.modelId,
        promptId: mockUseChat.promptId,
        systemMessage: mockUseChat.systemMessage,
      });
      expect(useAddMessage().mutateAsync).toHaveBeenCalledWith({
        chatId: mockChatId,
        message: trimmedAutoSubmitText,
        knowledgeBaseIds: [],
        documentIds: [],
        deepResearchEnabled: false,
        useGraph: false,
        graphEntityIds: [],
        graphScopeSource: 'document',
      });
    });
  });
});

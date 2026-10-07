import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';
import { MantineProvider } from '@mantine/core';

import EmptyChatSuggestions, { ChatEmptySuggestions, ChatGreeting } from './EmptyChatSuggestions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useGetPrompts } from '@/features/library/api/get-prompts';
import useGetAvailableAgentProviders from '@/features/shared/api/get-available-agent-providers';
import useGetChats from '@/features/chat/api/get-chats';
import useGetChatMetadata from '@/features/chat/api/get-chat-metadata';
import { appTheme } from '@/providers/AppMantineProvider';
import { renderWrapper } from '@/test/test-utils';

// Renders with the app's Mantine theme so `theme.other.fontWeights` tokens resolve.
const renderWithTheme = (ui: React.ReactElement) => renderWrapper(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn().mockReturnValue({ data: { user: { name: 'Test User' } } }),
}));

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/library/api/get-prompts');
jest.mock('@/features/shared/api/get-available-agent-providers');
jest.mock('@/features/chat/api/get-chats');
jest.mock('@/features/chat/api/get-chat-metadata');

describe('EmptyChatSuggestions', () => {
  const mockRouter = { push: jest.fn() };

  const mockUseChat = {
    setPrefilledMessage: jest.fn(),
    setAutoSubmitMessage: jest.fn(),
    setTriggerEditSystemPrompt: jest.fn(),
    setModelId: jest.fn(),
    hasUserInteracted: false,
    hasUserSubmittedMessageInSession: false,
    modelId: null,
    showAgentOnboarding: false,
    setShowAgentOnboarding: jest.fn(),
    messageInputHasText: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useChat as jest.Mock).mockReturnValue(mockUseChat);
    (useGetPrompts as jest.Mock).mockReturnValue({ data: undefined, isLoading: false });
    (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({ data: undefined });
  });

  it('renders the greeting heading', () => {
    renderWrapper(<ChatGreeting />);
    expect(screen.getByTestId('empty-state-heading')).toBeInTheDocument();
  });

  it('does not render when hasUserInteracted is true', () => {
    (useChat as jest.Mock).mockReturnValue({ ...mockUseChat, hasUserInteracted: true });
    const { container } = renderWrapper(<EmptyChatSuggestions />);
    expect(container.firstChild).toBeNull();
  });

  describe('agent onboarding', () => {
    it('shows onboarding when showAgentOnboarding is true and no message submitted', () => {
      (useChat as jest.Mock).mockReturnValue({
        ...mockUseChat,
        showAgentOnboarding: true,
        hasUserSubmittedMessageInSession: false,
      });
      renderWrapper(<EmptyChatSuggestions />);
      expect(screen.getByTestId('agent-onboarding')).toBeInTheDocument();
    });

    it('does not show onboarding when hasUserSubmittedMessageInSession is true', () => {
      (useChat as jest.Mock).mockReturnValue({
        ...mockUseChat,
        showAgentOnboarding: true,
        hasUserSubmittedMessageInSession: true,
      });
      const { container } = renderWrapper(<EmptyChatSuggestions />);
      expect(container.firstChild).toBeNull();
    });
  });
});

describe('ChatEmptySuggestions', () => {
  const mockRouter = { push: jest.fn() };

  const mockUseChat = {
    setPrefilledMessage: jest.fn(),
    setAutoSubmitMessage: jest.fn(),
    setTriggerEditSystemPrompt: jest.fn(),
    setShowSystemEntry: jest.fn(),
    setModelId: jest.fn(),
    hasUserInteracted: false,
    hasUserSubmittedMessageInSession: false,
    modelId: null,
    showAgentOnboarding: false,
    setShowAgentOnboarding: jest.fn(),
    messageInputHasText: false,
  };

  const mockAllPrompts = {
    prompts: [
      { id: 'prompt-1', title: 'Most Chatted Prompt', summary: 'Most chats', tags: ['writing'] },
      { id: 'prompt-2', title: 'Most Bookmarked Prompt', summary: 'Most bookmarks', tags: ['code'] },
      { id: 'prompt-3', title: 'Recent Prompt', summary: 'Recent', tags: ['brainstorm'] },
    ],
    stats: {
      'prompt-1': { usageCount: 100, bookmarkCount: 10 },
      'prompt-2': { usageCount: 50, bookmarkCount: 150 },
      'prompt-3': { usageCount: 5, bookmarkCount: 2 },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useChat as jest.Mock).mockReturnValue(mockUseChat);
    (useGetPrompts as jest.Mock).mockReturnValue({ data: mockAllPrompts, isLoading: false, isPending: false });
    (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({ data: undefined });
    (useGetChats as jest.Mock).mockReturnValue({ data: { chats: [] }, isPending: false });
    (useGetChatMetadata as jest.Mock).mockReturnValue({ data: { metadata: [] } });
  });

  it('renders fixed action rows', () => {
    renderWithTheme(<ChatEmptySuggestions />);
    expect(screen.getByTestId('suggestion-generate-prd')).toBeInTheDocument();
  });

  it('renders all three library slots with distinct badges', () => {
    renderWithTheme(<ChatEmptySuggestions />);
    expect(screen.getByTestId('suggestion-library-most_chatted')).toBeInTheDocument();
    expect(screen.getByTestId('badge-most_chatted')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-library-most_bookmarked')).toBeInTheDocument();
    expect(screen.getByTestId('badge-most_bookmarked')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-library-recent')).toBeInTheDocument();
    expect(screen.getByTestId('badge-recent')).toBeInTheDocument();
  });

  it('renders browse all footer', () => {
    renderWithTheme(<ChatEmptySuggestions />);
    expect(screen.getByTestId('browse-all-prompts')).toBeInTheDocument();
  });

  it('calls setPrefilledMessage when generate-prd row is clicked without agent providers', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWithTheme(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('suggestion-generate-prd'));
    jest.useRealTimers();
    expect(mockUseChat.setPrefilledMessage).toHaveBeenCalledWith(expect.stringContaining('product requirements document'));
  });

  it('navigates to library when browse-all is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWithTheme(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('browse-all-prompts'));
    jest.useRealTimers();
    expect(mockRouter.push).toHaveBeenCalledWith('/library');
  });

  it('navigates to chat with promptid when most-chatted slot is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWithTheme(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('suggestion-library-most_chatted'));
    jest.useRealTimers();
    expect(mockRouter.push).toHaveBeenCalledWith('/chat?promptid=prompt-1');
  });

  it('does not render when hasUserInteracted is true', () => {
    (useChat as jest.Mock).mockReturnValue({ ...mockUseChat, hasUserInteracted: true });
    const { container } = renderWithTheme(<ChatEmptySuggestions />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render library slots or footer when prompts list is empty', () => {
    (useGetPrompts as jest.Mock).mockReturnValue({
      data: { prompts: [], stats: {} },
      isLoading: false,
    });
    renderWithTheme(<ChatEmptySuggestions />);
    expect(screen.queryByTestId('suggestion-library-most_chatted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('browse-all-prompts')).not.toBeInTheDocument();
  });

  it('does not render when showing agent onboarding', () => {
    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      showAgentOnboarding: true,
      hasUserSubmittedMessageInSession: false,
    });
    const { container } = renderWithTheme(<ChatEmptySuggestions />);
    expect(container.firstChild).toBeNull();
  });

  describe('recent chats', () => {
    const mockChat = (id: string, summary: string | null, updatedAt: string) => ({
      id,
      userId: 'user-1',
      modelId: null,
      promptId: null,
      agentProviderId: null,
      summary,
      externalSessionId: null,
      createdAt: updatedAt,
      updatedAt,
    });

    it('shows 1 recent chat, 2 prompt slots, and the browse-all link', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByTestId('suggestion-recent-chat-chat-1')).toBeInTheDocument();
      expect(screen.getByText('First chat')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-library-most_chatted')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-library-most_bookmarked')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-library-recent')).not.toBeInTheDocument();
      expect(screen.getByTestId('browse-all-prompts')).toBeInTheDocument();
    });

    it('shows 2 recent chats, 1 prompt slot, and the browse-all link', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: {
          chats: [
            mockChat('chat-1', 'Older chat', '2026-08-19T00:00:00.000Z'),
            mockChat('chat-2', 'Newer chat', '2026-08-20T00:00:00.000Z'),
          ],
        },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByTestId('suggestion-recent-chat-chat-1')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-2')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-library-most_chatted')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-library-most_bookmarked')).not.toBeInTheDocument();
      expect(screen.getByTestId('browse-all-prompts')).toBeInTheDocument();
    });

    it('shows 3 recent chats, no prompt slots, and hides the browse-all link', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: {
          chats: [
            mockChat('chat-1', 'Chat one', '2026-08-18T00:00:00.000Z'),
            mockChat('chat-2', 'Chat two', '2026-08-19T00:00:00.000Z'),
            mockChat('chat-3', 'Chat three', '2026-08-20T00:00:00.000Z'),
          ],
        },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByTestId('suggestion-recent-chat-chat-1')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-2')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-3')).toBeInTheDocument();
      expect(screen.queryByTestId('suggestion-library-most_chatted')).not.toBeInTheDocument();
      expect(screen.queryByTestId('browse-all-prompts')).not.toBeInTheDocument();
    });

    it('caps at the 3 most recently updated chats when more exist', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: {
          chats: [
            mockChat('chat-old', 'Oldest chat', '2026-08-01T00:00:00.000Z'),
            mockChat('chat-1', 'Chat one', '2026-08-18T00:00:00.000Z'),
            mockChat('chat-2', 'Chat two', '2026-08-19T00:00:00.000Z'),
            mockChat('chat-3', 'Chat three', '2026-08-20T00:00:00.000Z'),
          ],
        },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.queryByTestId('suggestion-recent-chat-chat-old')).not.toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-1')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-2')).toBeInTheDocument();
      expect(screen.getByTestId('suggestion-recent-chat-chat-3')).toBeInTheDocument();
    });

    it('falls back to "New chat" when a chat has no summary yet', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', null, '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByText('New chat')).toBeInTheDocument();
    });

    it('navigates to the chat when a recent chat row is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      jest.useFakeTimers();
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      await act(async () => { jest.runAllTimers(); });
      await user.click(screen.getByTestId('suggestion-recent-chat-chat-1'));
      jest.useRealTimers();
      expect(mockRouter.push).toHaveBeenCalledWith('/chat/chat-1');
    });

    it('shows model/agent name, message count, and overlapping artifact icons for a recent chat', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      (useGetChatMetadata as jest.Mock).mockReturnValue({
        data: {
          metadata: [
            {
              chatId: 'chat-1',
              modelName: 'GPT-4o',
              agentProviderName: null,
              messageCount: 6,
              artifacts: [
                { id: 'artifact-1', label: 'Report', fileExtension: '.md' },
                { id: 'artifact-2', label: 'Chart', fileExtension: '.html' },
              ],
            },
          ],
        },
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByText('GPT-4o')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByTestId('chat-artifact-icon-artifact-1')).toBeInTheDocument();
      expect(screen.getByTestId('chat-artifact-icon-artifact-2')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-artifact-icon-overflow')).not.toBeInTheDocument();
    });

    it('collapses extra artifacts into a "+N" overflow icon', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      (useGetChatMetadata as jest.Mock).mockReturnValue({
        data: {
          metadata: [
            {
              chatId: 'chat-1',
              modelName: null,
              agentProviderName: null,
              messageCount: 0,
              artifacts: [
                { id: 'artifact-1', label: 'Report', fileExtension: '.md' },
                { id: 'artifact-2', label: 'Chart', fileExtension: '.html' },
                { id: 'artifact-3', label: 'Sheet', fileExtension: '.csv' },
                { id: 'artifact-4', label: 'Deck', fileExtension: '.pptx' },
              ],
            },
          ],
        },
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.getByTestId('chat-artifact-icon-artifact-1')).toBeInTheDocument();
      expect(screen.getByTestId('chat-artifact-icon-artifact-2')).toBeInTheDocument();
      expect(screen.getByTestId('chat-artifact-icon-artifact-3')).toBeInTheDocument();
      expect(screen.queryByTestId('chat-artifact-icon-artifact-4')).not.toBeInTheDocument();
      expect(screen.getByTestId('chat-artifact-icon-overflow')).toBeInTheDocument();
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('shows the artifact filename in the icon tooltip', async () => {
      const user = userEvent.setup();
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      (useGetChatMetadata as jest.Mock).mockReturnValue({
        data: {
          metadata: [
            {
              chatId: 'chat-1',
              modelName: null,
              agentProviderName: null,
              messageCount: 0,
              artifacts: [{ id: 'artifact-1', label: 'Survey Feedback', fileExtension: '.xlsx' }],
            },
          ],
        },
      });
      renderWithTheme(<ChatEmptySuggestions />);
      await user.hover(screen.getByTestId('chat-artifact-icon-artifact-1'));
      expect(await screen.findByText('Survey Feedback.xlsx')).toBeInTheDocument();
    });

    it('does not show metadata extras when a recent chat has no metadata yet', () => {
      (useGetChats as jest.Mock).mockReturnValue({
        data: { chats: [mockChat('chat-1', 'First chat', '2026-08-20T00:00:00.000Z')] },
        isPending: false,
      });
      renderWithTheme(<ChatEmptySuggestions />);
      expect(screen.queryByTestId('chat-artifact-icon-overflow')).not.toBeInTheDocument();
    });
  });

  describe('with agent providers', () => {
    const mockAgentProviders = {
      availableAgentProviders: [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'PRD Agent', description: 'Agent for generating PRDs' },
      ],
    };

    beforeEach(() => {
      (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({ data: mockAgentProviders });
    });

    it('selects agent provider and shows onboarding when generate-prd row is clicked', async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      jest.useFakeTimers();
      const mockSetModelId = jest.fn();
      const mockSetShowAgentOnboarding = jest.fn();
      (useChat as jest.Mock).mockReturnValue({
        ...mockUseChat,
        setModelId: mockSetModelId,
        setShowAgentOnboarding: mockSetShowAgentOnboarding,
      });

      renderWithTheme(<ChatEmptySuggestions />);
      await act(async () => { jest.runAllTimers(); });
      await user.click(screen.getByTestId('suggestion-generate-prd'));
      jest.useRealTimers();

      expect(mockSetModelId).toHaveBeenCalledWith('agent-provider::550e8400-e29b-41d4-a716-446655440000');
      expect(mockSetShowAgentOnboarding).toHaveBeenCalledWith(true);
    });
  });
});

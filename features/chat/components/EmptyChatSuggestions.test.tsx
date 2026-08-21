import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/router';

import EmptyChatSuggestions, { ChatEmptySuggestions, ChatGreeting } from './EmptyChatSuggestions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import { useGetPrompts } from '@/features/library/api/get-prompts';
import useGetAvailableAgentProviders from '@/features/shared/api/get-available-agent-providers';
import { renderWrapper } from '@/test/test-utils';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('next-auth/react', () => ({
  useSession: jest.fn().mockReturnValue({ data: { user: { name: 'Test User' } } }),
}));

jest.mock('@/features/chat/providers/ChatProvider');
jest.mock('@/features/library/api/get-prompts');
jest.mock('@/features/shared/api/get-available-agent-providers');

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
    (useGetPrompts as jest.Mock).mockReturnValue({ data: mockAllPrompts, isLoading: false });
    (useGetAvailableAgentProviders as jest.Mock).mockReturnValue({ data: undefined });
  });

  it('renders fixed action rows', () => {
    renderWrapper(<ChatEmptySuggestions />);
    expect(screen.getByTestId('suggestion-generate-prd')).toBeInTheDocument();
  });

  it('renders all three library slots with distinct badges', () => {
    renderWrapper(<ChatEmptySuggestions />);
    expect(screen.getByTestId('suggestion-library-most_chatted')).toBeInTheDocument();
    expect(screen.getByTestId('badge-most_chatted')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-library-most_bookmarked')).toBeInTheDocument();
    expect(screen.getByTestId('badge-most_bookmarked')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-library-recent')).toBeInTheDocument();
    expect(screen.getByTestId('badge-recent')).toBeInTheDocument();
  });

  it('renders browse all footer', () => {
    renderWrapper(<ChatEmptySuggestions />);
    expect(screen.getByTestId('browse-all-prompts')).toBeInTheDocument();
  });

  it('calls setPrefilledMessage when generate-prd row is clicked without agent providers', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWrapper(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('suggestion-generate-prd'));
    jest.useRealTimers();
    expect(mockUseChat.setPrefilledMessage).toHaveBeenCalledWith(expect.stringContaining('product requirements document'));
  });

  it('navigates to library when browse-all is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWrapper(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('browse-all-prompts'));
    jest.useRealTimers();
    expect(mockRouter.push).toHaveBeenCalledWith('/library');
  });

  it('navigates to chat with promptid when most-chatted slot is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.useFakeTimers();
    renderWrapper(<ChatEmptySuggestions />);
    await act(async () => { jest.runAllTimers(); });
    await user.click(screen.getByTestId('suggestion-library-most_chatted'));
    jest.useRealTimers();
    expect(mockRouter.push).toHaveBeenCalledWith('/chat?promptid=prompt-1');
  });

  it('does not render when hasUserInteracted is true', () => {
    (useChat as jest.Mock).mockReturnValue({ ...mockUseChat, hasUserInteracted: true });
    const { container } = renderWrapper(<ChatEmptySuggestions />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render library slots or footer when prompts list is empty', () => {
    (useGetPrompts as jest.Mock).mockReturnValue({
      data: { prompts: [], stats: {} },
      isLoading: false,
    });
    renderWrapper(<ChatEmptySuggestions />);
    expect(screen.queryByTestId('suggestion-library-most_chatted')).not.toBeInTheDocument();
    expect(screen.queryByTestId('browse-all-prompts')).not.toBeInTheDocument();
  });

  it('does not render when showing agent onboarding', () => {
    (useChat as jest.Mock).mockReturnValue({
      ...mockUseChat,
      showAgentOnboarding: true,
      hasUserSubmittedMessageInSession: false,
    });
    const { container } = renderWrapper(<ChatEmptySuggestions />);
    expect(container.firstChild).toBeNull();
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

      renderWrapper(<ChatEmptySuggestions />);
      await act(async () => { jest.runAllTimers(); });
      await user.click(screen.getByTestId('suggestion-generate-prd'));
      jest.useRealTimers();

      expect(mockSetModelId).toHaveBeenCalledWith('agent-provider::550e8400-e29b-41d4-a716-446655440000');
      expect(mockSetShowAgentOnboarding).toHaveBeenCalledWith(true);
    });
  });
});

import { render, fireEvent, waitFor } from '@testing-library/react';

import { generateConversationUrl } from '@/features/chat/utils/chatHelperFunctions';
import ChatHistoryNavLink from './ChatHistoryNavLink';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';
import { useRouter } from 'next/router';

jest.mock('@/features/chat/api/get-origin-prompt');
jest.mock('@/features/chat/api/update-chat-conversation-summary');

jest.mock('@/features/chat/utils/chatHelperFunctions', () => ({
  generateConversationUrl: jest.fn(),
}));
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('ChatHistoryNavLink', () => {
  const chatId = '12345';
  const summary = 'Chat Summary';
  const promptId = '67890';
  const mockHref = `/chat/${chatId}`;
  const mockOnDeleteClick = jest.fn();
  const mockUpdateChatConversationSummary = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isPending: false,
      isFetched: false,
      data: null,
    });

    (generateConversationUrl as jest.Mock).mockReturnValue(mockHref);

    (useUpdateChatConversationSummary as jest.Mock).mockReturnValue({
      mutate: mockUpdateChatConversationSummary,
    });

    (useRouter as jest.Mock).mockReturnValue({
      push: jest.fn(),
    });
  });

  it('renders correctly with a summary', () => {
    const { getByTestId, queryByTestId, getByText } = render(
      <ChatHistoryNavLink chatId={chatId} summary={summary} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    const navLink = getByTestId(`${chatId}-chat-history-nav-link`);
    fireEvent.click(navLink);

    expect(getByText(summary)).toBeInTheDocument();
    expect(queryByTestId(`${chatId}-loader`)).not.toBeInTheDocument();
    expect(getByTestId(`${chatId}-chat-delete-icon`)).toBeInTheDocument();
  });

  it('renders correctly with the Loader component with an empty-string summary', () => {
    const { getByTestId, queryByText } = render(
      <ChatHistoryNavLink chatId={chatId} summary={''} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    const navLink = getByTestId(`${chatId}-chat-history-nav-link`);
    fireEvent.click(navLink);

    expect(queryByText(summary)).not.toBeInTheDocument();
    expect(getByTestId(`${chatId}-loader`)).toBeInTheDocument();
    expect(getByTestId(`${chatId}-chat-delete-icon`)).toBeInTheDocument();
  });

  it('renders correctly with the Loader component with a null summary', () => {
    const { getByTestId, queryByText } = render(
      <ChatHistoryNavLink chatId={chatId} summary={null} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    const navLink = getByTestId(`${chatId}-chat-history-nav-link`);
    fireEvent.click(navLink);

    expect(queryByText(summary)).not.toBeInTheDocument();
    expect(getByTestId(`${chatId}-loader`)).toBeInTheDocument();
    expect(getByTestId(`${chatId}-chat-delete-icon`)).toBeInTheDocument();
  });

  it('calls onDeleteClick when ActionIcon is clicked', () => {
    const { getByTestId } = render(
      <ChatHistoryNavLink chatId={chatId} summary={summary} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    fireEvent.click(getByTestId(`${chatId}-chat-delete-icon`));
    expect(mockOnDeleteClick).toHaveBeenCalledWith(expect.any(Object), chatId);
  });

  it('renders the title tooltip correctly', () => {
    const { getByTestId } = render(
      <ChatHistoryNavLink chatId={chatId} summary={summary} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    const navLink = getByTestId(`${chatId}-chat-history-nav-link`);
    expect(navLink).toHaveAttribute('title', summary);
  });

  it('adds prompt slug to href if chat is associated with a prompt', async () => {
    const promptTitle = 'Sample Prompt Title';
    const mockHref = `/chat/${chatId}/sample-prompt-title`;

    (useGetOriginPrompt as jest.Mock).mockReturnValue({
      isPending: false,
      isFetched: true,
      data: { prompt: { title: promptTitle } },
    });

    (generateConversationUrl as jest.Mock).mockReturnValue(mockHref);

    const { getByTestId } = render(
      <ChatHistoryNavLink chatId={chatId} summary={summary} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );

    await waitFor(() => {
      const navLink = getByTestId(`${chatId}-chat-history-nav-link`);
      fireEvent.click(navLink);
    });
  });

  it('calls updateChatConversationSummary if summary is an empty string', () => {
    render(
      <ChatHistoryNavLink chatId={chatId} summary={''} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );
    expect(mockUpdateChatConversationSummary).toHaveBeenCalledWith({ chatId });
  });

  it('does not call updateChatConversationSummary if summary is a non-empty string', () => {
    render(
      <ChatHistoryNavLink chatId={chatId} summary={summary} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );
    expect(mockUpdateChatConversationSummary).not.toHaveBeenCalled();
  });

  it('does not call updateChatConversationSummary if summary is null', () => {
    render(
      <ChatHistoryNavLink chatId={chatId} summary={null} promptId={promptId} onDeleteClick={mockOnDeleteClick} />
    );
    expect(mockUpdateChatConversationSummary).not.toHaveBeenCalled();
  });
});

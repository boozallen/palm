import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';
import UseCaseChatList from './UseCaseChatList';
import useGetChatTranscript from '@/features/context-studio/api/get-chat-transcript';
import { UseCaseChatRow } from '@/features/context-studio/types/use-case-detail';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UseCase } from '@/features/shared/types/use-case';
import { appTheme } from '@/providers/AppMantineProvider';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);
};

jest.mock('@/features/context-studio/api/get-chat-transcript');
jest.mock('@/features/context-studio/components/ChatTranscript', () => ({
  __esModule: true,
  default: ({ messages, userName }: { messages: unknown[]; userName: string | null }) => (
    <div data-testid='chat-transcript'>
      Transcript for {userName ?? 'unknown'} ({messages.length} messages)
    </div>
  ),
}));

const mockUseGetChatTranscript = useGetChatTranscript as jest.MockedFunction<typeof useGetChatTranscript>;

const USE_CASE = UseCase.ProposalCapture;
const GROUP_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';

const renderList = (chats: UseCaseChatRow[], totalChats: number) =>
  renderWithTheme(
    <UseCaseChatList
      chats={chats}
      totalChats={totalChats}
      useCase={USE_CASE}
      timeRange={TimeRange.Month}
      userGroupId={GROUP_ID}
      userId={USER_ID}
    />,
  );

const createMockChat = (overrides: Partial<UseCaseChatRow> = {}): UseCaseChatRow => ({
  chatId: 'chat-1',
  title: 'Test Chat',
  ownerUserId: 'user-1',
  ownerName: 'Test User',
  ownerEmail: 'test@example.com',
  cost: 10.5,
  artifacts: 3,
  putToWork: 2,
  createdAt: new Date('2024-01-01'),
  ...overrides,
});

describe('UseCaseChatList', () => {
  beforeEach(() => {
    mockUseGetChatTranscript.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as never);
  });

  it('renders one row per chat', () => {
    const chats = [
      createMockChat({ chatId: 'chat-1' }),
      createMockChat({ chatId: 'chat-2' }),
      createMockChat({ chatId: 'chat-3' }),
    ];

    renderList(chats, 3);

    const rows = screen.getAllByTestId('use-case-chat-row');
    expect(rows).toHaveLength(3);
  });

  it('sorts by spend descending on first render', () => {
    const chats = [
      createMockChat({ chatId: 'chat-1', cost: 5, title: 'Low' }),
      createMockChat({ chatId: 'chat-2', cost: 20, title: 'High' }),
      createMockChat({ chatId: 'chat-3', cost: 10, title: 'Medium' }),
    ];

    renderList(chats, 3);

    const rows = screen.getAllByTestId('use-case-chat-row');
    const firstRowTitle = within(rows[0]).getByTestId('use-case-chat-title');
    expect(firstRowTitle).toHaveTextContent('High');
  });

  it('re-sorts when a numeric column header is clicked', async () => {
    const user = userEvent.setup();
    const chats = [
      createMockChat({ chatId: 'chat-1', putToWork: 5, title: 'Low' }),
      createMockChat({ chatId: 'chat-2', putToWork: 20, title: 'High' }),
      createMockChat({ chatId: 'chat-3', putToWork: 10, title: 'Medium' }),
    ];

    renderList(chats, 3);

    const sortButton = screen.getByTestId('use-case-chat-sort-used');
    await user.click(sortButton);

    const rows = screen.getAllByTestId('use-case-chat-row');
    const firstRowTitle = within(rows[0]).getByTestId('use-case-chat-title');
    expect(firstRowTitle).toHaveTextContent('High');
  });

  it('names an untitled chat rather than rendering a blank cell', () => {
    const chats = [createMockChat({ title: null })];

    renderList(chats, 1);

    const titleCell = screen.getByTestId('use-case-chat-title');
    expect(titleCell).toHaveTextContent('(untitled chat)');
  });

  it('pages at twenty-five rows', () => {
    const chats = Array.from({ length: 30 }, (_, i) =>
      createMockChat({ chatId: `chat-${i}`, cost: 100 - i }),
    );

    renderList(chats, 30);

    const rows = screen.getAllByTestId('use-case-chat-row');
    expect(rows).toHaveLength(25);
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
  });

  it('fetches the transcript only once a row is expanded', async () => {
    const user = userEvent.setup();
    const chats = [createMockChat({ chatId: 'chat-1', ownerName: 'Test User' })];

    mockUseGetChatTranscript.mockReturnValue({
      data: [
        {
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
          usageSteps: [],
        },
      ],
      isLoading: false,
      error: null,
    } as never);

    renderList(chats, 1);

    expect(mockUseGetChatTranscript).toHaveBeenCalledWith(
      null, USE_CASE, TimeRange.Month, GROUP_ID, USER_ID, false,
    );

    const row = screen.getByTestId('use-case-chat-row');
    await user.click(row);

    // The filters travel with the request so the server can check the chat against
    // the same scope this list was selected under.
    await waitFor(() => {
      expect(mockUseGetChatTranscript).toHaveBeenCalledWith(
        'chat-1', USE_CASE, TimeRange.Month, GROUP_ID, USER_ID, true,
      );
    });

    expect(screen.getByTestId('chat-transcript')).toBeInTheDocument();
  });

  // Someone who expands a row whose transcript can't be loaded must be told so
  // rather than left with an empty panel.
  it('says the transcript could not be loaded when the request fails', async () => {
    const user = userEvent.setup();
    const chats = [createMockChat({ chatId: 'chat-1' })];

    mockUseGetChatTranscript.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);

    renderList(chats, 1);

    await user.click(screen.getByTestId('use-case-chat-row'));

    await waitFor(() => {
      expect(screen.getByTestId('use-case-chat-transcript-error')).toBeInTheDocument();
    });
  });

  it('says how many chats are shown when the list was capped', () => {
    const chats = Array.from({ length: 500 }, (_, i) =>
      createMockChat({ chatId: `chat-${i}`, cost: 1000 - i }),
    );

    renderList(chats, 1203);

    const capMessage = screen.getByTestId('use-case-chat-cap');
    expect(capMessage).toHaveTextContent('showing the 500 largest by spend of 1,203 chats');
  });
});

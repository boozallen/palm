import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MantineProvider } from '@mantine/core';

import UseCaseDetailDrawer from './UseCaseDetailDrawer';
import { UseCase } from '@/features/shared/types/use-case';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { appTheme } from '@/providers/AppMantineProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);
}

jest.mock('@/features/context-studio/api/get-use-case-detail');
jest.mock('@/features/context-studio/api/get-use-case-themes');
jest.mock('@/features/context-studio/api/get-chat-transcript');

import useGetUseCaseDetail from '@/features/context-studio/api/get-use-case-detail';
import useGetUseCaseThemes from '@/features/context-studio/api/get-use-case-themes';
import useGetChatTranscript from '@/features/context-studio/api/get-chat-transcript';

const mockTimeRange = TimeRange.Month;

const mockDetail = {
  useCase: UseCase.ResearchAnalysis,
  cost: 125.50,
  artifacts: 42,
  putToWork: 38,
  totalChats: 150,
  chats: [
    {
      chatId: 'chat-1',
      title: 'Test Chat',
      ownerUserId: 'user-1',
      ownerName: 'Test User',
      ownerEmail: 'test@example.com',
      cost: 10.5,
      artifacts: 2,
      putToWork: 1,
      createdAt: '2024-01-15T00:00:00.000Z',
    },
  ],
  people: [
    {
      userId: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      chats: 10,
      cost: 50.0,
      artifacts: 20,
      putToWork: 15,
    },
  ],
  teams: [
    {
      userGroupId: 'team-1',
      label: 'Test Team',
      chats: 50,
      cost: 100.0,
      artifacts: 40,
      putToWork: 35,
    },
  ],
  artifactList: [
    {
      artifactId: 'artifact-1',
      name: 'Test Artifact',
      chatId: 'chat-1',
      signals: ['downloaded' as const],
    },
  ],
  weekly: [
    {
      weekStart: '2024-01-01T00:00:00.000Z',
      cost: 50.0,
      shareOfChatSpend: 0.25,
    },
    {
      weekStart: '2024-01-08T00:00:00.000Z',
      cost: 75.5,
      shareOfChatSpend: 0.30,
    },
  ],
};

const mockThemes = {
  themes: [
    {
      name: 'Data analysis',
      chats: 50,
      cost: 60.0,
    },
    {
      name: 'Code review',
      chats: 30,
      cost: 40.0,
    },
  ],
  remainder: null,
  coveredChats: 80,
  analyzedChats: 100,
  truncated: false,
};

function mockDetailQuery(data: typeof mockDetail | null, isLoading: boolean, isError: boolean) {
  (useGetUseCaseDetail as jest.Mock).mockReturnValue({
    data,
    isLoading,
    isError,
  });
}

function mockThemesQuery(data: typeof mockThemes | null, isLoading: boolean, isError: boolean) {
  (useGetUseCaseThemes as jest.Mock).mockReturnValue({
    data,
    isLoading,
    isError,
  });
}

function mockTranscriptQuery() {
  (useGetChatTranscript as jest.Mock).mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
  });
}

describe('UseCaseDetailDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTranscriptQuery();
  });

  it('is closed when no category is selected', () => {
    mockDetailQuery(null, false, false);
    mockThemesQuery(null, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={null}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('use-case-detail-drawer')).toBeNull();
  });

  it('names the selected category and repeats the row figures', () => {
    mockDetailQuery(mockDetail, false, false);
    mockThemesQuery(mockThemes, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={UseCase.ResearchAnalysis}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('use-case-detail-drawer')).toBeInTheDocument();
    const header = screen.getByTestId('use-case-detail-header');
    expect(header).toBeInTheDocument();
    expect(header).toHaveTextContent('$125.50');
    expect(header).toHaveTextContent('25%');
    expect(header).toHaveTextContent('42');
    expect(header).toHaveTextContent('38');
    expect(header).toHaveTextContent('$3.30');
  });

  it('renders the chat list once the detail query lands', () => {
    mockDetailQuery(mockDetail, false, false);
    mockThemesQuery(mockThemes, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={UseCase.ResearchAnalysis}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('use-case-chat-row')).toBeInTheDocument();
  });

  it('renders the chat list even when the themes query failed', () => {
    mockDetailQuery(mockDetail, false, false);
    mockThemesQuery(null, false, true);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={UseCase.ResearchAnalysis}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('use-case-themes-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('use-case-chat-row')).toBeInTheDocument();
  });

  it('shows a load error inside the drawer when the detail query fails', () => {
    mockDetailQuery(null, false, true);
    mockThemesQuery(null, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={UseCase.ResearchAnalysis}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('studio-load-error')).toBeInTheDocument();
  });

  it('fires neither query while closed', () => {
    mockDetailQuery(null, false, false);
    mockThemesQuery(null, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={null}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={jest.fn()}
      />,
    );

    expect(useGetUseCaseDetail).toHaveBeenCalledWith(
      expect.anything(),
      mockTimeRange,
      'all',
      'all',
      false,
    );
    expect(useGetUseCaseThemes).toHaveBeenCalledWith(
      expect.anything(),
      mockTimeRange,
      'all',
      'all',
      false,
    );
  });

  it('closes when the close control is used', async () => {
    const onClose = jest.fn();
    mockDetailQuery(mockDetail, false, false);
    mockThemesQuery(mockThemes, false, false);

    renderWithTheme(
      <UseCaseDetailDrawer
        useCase={UseCase.ResearchAnalysis}
        chatCost={500.0}
        timeRange={mockTimeRange}
        userGroupId='all'
        userId='all'
        onClose={onClose}
      />,
    );

    const drawer = screen.getByTestId('use-case-detail-drawer');
    const closeButton = drawer.querySelector('.mantine-Drawer-close');
    if (closeButton) {
      await userEvent.click(closeButton as Element);
    }

    expect(onClose).toHaveBeenCalled();
  });
});

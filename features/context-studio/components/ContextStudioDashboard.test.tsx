import { act, render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import { SessionProvider } from 'next-auth/react';
import ContextStudioDashboard from './ContextStudioDashboard';
import useGetArtifactStats from '@/features/context-studio/api/get-artifact-stats';
import useGetGraphStats from '@/features/context-studio/api/get-graph-stats';
import useSearchChats from '@/features/context-studio/api/search-chats';
import useSearchDocuments from '@/features/context-studio/api/search-documents';
import useSearchUsers from '@/features/context-studio/api/search-users';
import useSearchArtifacts from '@/features/context-studio/api/search-artifacts';
import useGetAgentProposalJobs from '@/features/context-studio/api/get-agent-proposal-jobs';
import { UserRole } from '@/features/shared/types/user';

// The tab strip is what's under test, so the panels are stubbed down to a marker
// each. That keeps the assertions about which sections a tab reveals, rather
// than about how any one section renders.
jest.mock('./panels/AgentsPanel', () => {
  return function AgentsPanel() {
    return <div data-testid='agents-panel' />;
  };
});

jest.mock('./sections/PageTransitions', () => {
  return function PageTransitions() {
    return <div data-testid='page-transitions' />;
  };
});

jest.mock('./sections/UserActivityTimeline', () => {
  return function UserActivityTimeline() {
    return <div data-testid='user-activity-timeline' />;
  };
});

jest.mock('./sections/GraphStatsCard', () => {
  return function GraphStatsCard() {
    return <div data-testid='graph-stats-card' />;
  };
});

jest.mock('./sections/UserGroupsCard', () => {
  return function UserGroupsCard() {
    return <div data-testid='user-groups-card' />;
  };
});

jest.mock('./sections/KnowledgeGraphSection', () => {
  return function KnowledgeGraphSection() {
    return <div data-testid='knowledge-graph-section' />;
  };
});

jest.mock('./sections/UserActivitySection', () => {
  return function LoginActivitySection() {
    return <div data-testid='login-activity-section' />;
  };
});

jest.mock('./inputs/TimeRangeInput', () => {
  return function TimeRangeInput() {
    return <div data-testid='time-range-input' />;
  };
});

jest.mock('./inputs/UserGroupInput', () => {
  return function UserGroupInput() {
    return <div data-testid='user-group-input' />;
  };
});

jest.mock('./inputs/UserInput', () => {
  return function UserInput() {
    return <div data-testid='user-input' />;
  };
});

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Every studio query hook resolves to empty data — these tests only assert on
// the `enabled` flag each hook is called with, never on returned rows.
jest.mock('@/features/context-studio/api/get-prompt-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-chat-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-document-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-ai-agent-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-agent-proposal-jobs', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isError: false })),
}));

jest.mock('@/features/context-studio/api/get-workflow-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-graph-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-user-activity-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-agent-service-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-artifact-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-conversation-tool-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-page-transitions', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-user-activity', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('./sections/cost/CostSection', () => {
  return function CostSection() {
    return <div data-testid='cost-section' />;
  };
});

jest.mock('./sections/value/ValueSection', () => {
  return function ValueSection() {
    return <div data-testid='value-section' />;
  };
});

// The search hooks are gated like the stats hooks, so their results carry
// `isPending` too — a disabled query is pending, not empty.
jest.mock('@/features/context-studio/api/search-chats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isPending: true })),
}));

jest.mock('@/features/context-studio/api/search-documents', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isPending: true })),
}));

jest.mock('@/features/context-studio/api/search-users', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isPending: true })),
}));

jest.mock('@/features/context-studio/api/search-artifacts', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isPending: true })),
}));

// CSV export walks every page of a search past the first, via `trpc.useUtils()`.
const mockGetArtifactContentFetch = jest.fn();
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      contextStudio: {
        searchChats: { fetch: jest.fn() },
        searchDocuments: { fetch: jest.fn() },
        searchUsers: { fetch: jest.fn() },
        getArtifactContent: { fetch: (...args: unknown[]) => mockGetArtifactContentFetch(...args) },
      },
    }),
  },
}));

describe('ContextStudioDashboard', () => {
  const push = jest.fn();

  // Every existing test below exercises an Admin's view of the studio, so
  // Admin is the default here; tab-visibility tests override the role.
  const renderWithTab = (tab?: string, role: UserRole = UserRole.Admin) => {
    (useRouter as jest.Mock).mockReturnValue({
      query: tab ? { tab } : {},
      pathname: '/context-studio',
      push,
    });
    return render(
      <SessionProvider session={{ expires: '1', user: { role, id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c' } }}>
        <ContextStudioDashboard />
      </SessionProvider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders every tab in the strip for an Admin', () => {
    renderWithTab();

    ['value', 'activity', 'conversations', 'knowledge', 'ai-agents', 'people', 'cost'].forEach((tab) => {
      expect(screen.getByTestId(`context-studio-${tab}-tab`)).toBeInTheDocument();
    });
  });

  // Value/Activity/AI Agents/People show org-wide breakdowns rather than data
  // scoped to a group, so a Lead or plain member never sees those tabs at all.
  describe('non-Admin viewers', () => {
    it('hides the Admin-only tabs and lands on Conversations by default', () => {
      renderWithTab(undefined, UserRole.User);

      ['value', 'activity', 'ai-agents', 'people'].forEach((tab) => {
        expect(screen.queryByTestId(`context-studio-${tab}-tab`)).not.toBeInTheDocument();
      });
      ['conversations', 'knowledge', 'cost'].forEach((tab) => {
        expect(screen.getByTestId(`context-studio-${tab}-tab`)).toBeInTheDocument();
      });
      expect(screen.getByTestId('context-studio-conversations-tab')).toHaveAttribute('aria-selected', 'true');
    });

    it('falls back to Conversations rather than an Admin-only tab named in the URL', () => {
      renderWithTab('value', UserRole.User);

      expect(screen.queryByTestId('context-studio-value-tab')).not.toBeInTheDocument();
      expect(screen.getByTestId('context-studio-conversations-tab')).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Value tab', () => {
    it('lands on it when the URL names no tab', () => {
      renderWithTab();

      expect(screen.getByTestId('context-studio-value-tab')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('value-section')).toBeInTheDocument();
    });

    // Placed first because a funding decision-maker should land on the story
    // rather than on tab seven.
    it('places it first, ahead of Activity', () => {
      renderWithTab();

      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('data-testid', 'context-studio-value-tab');
    });

    // Admins are excluded from every Value metric by definition, so the switch
    // would be a control that changes nothing.
    it('hides the Exclude Admins switch', () => {
      renderWithTab('value');

      expect(screen.queryByTestId('context-studio-exclude-admins')).not.toBeInTheDocument();
    });
  });

  // Cost replaces the standalone Analytics page, so it is a peer of the other
  // views and reads the same group-level grant rather than an Admin check.
  describe('Cost tab', () => {
    it('reveals the cost section when the tab is open', () => {
      renderWithTab('cost');

      expect(screen.getByTestId('context-studio-cost-tab')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('cost-section')).toBeInTheDocument();
    });

    // The one filter bar above the tab strip scopes Cost too, so the section
    // renders only its own provider/model/initiator filters.
    it('keeps the shared filter bar as the only time, group, and user control', () => {
      renderWithTab('cost');

      expect(screen.getByTestId('time-range-input')).toBeInTheDocument();
      expect(screen.getByTestId('user-group-input')).toBeInTheDocument();
      expect(screen.getByTestId('user-input')).toBeInTheDocument();
    });

    // Exclude Admins scopes the activity and people queries; the cost query has
    // no such filter, so showing the switch here would promise something it
    // cannot do.
    it('hides the Exclude Admins switch, which cost data cannot honor', () => {
      renderWithTab('cost');

      expect(screen.queryByTestId('context-studio-exclude-admins')).not.toBeInTheDocument();
    });

    it('keeps the Exclude Admins switch on every other tab', () => {
      renderWithTab('activity');

      expect(screen.getByTestId('context-studio-exclude-admins')).toBeInTheDocument();
    });
  });

  it('opens the tab named in the URL, so a view is linkable', () => {
    renderWithTab('ai-agents');

    expect(screen.getByTestId('context-studio-ai-agents-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('agents-panel')).toBeInTheDocument();
  });

  // An unknown tab param would otherwise select nothing and render an empty
  // shell, which reads as a broken page rather than a bad link.
  it('falls back to Value when the URL names an unknown tab', () => {
    renderWithTab('nonsense');

    expect(screen.getByTestId('context-studio-value-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('value-section')).toBeInTheDocument();
  });

  it('writes the chosen tab to the URL', () => {
    renderWithTab();

    fireEvent.click(screen.getByTestId('context-studio-knowledge-tab'));

    expect(push).toHaveBeenCalledWith(
      { pathname: '/context-studio', query: { tab: 'knowledge' } },
      undefined,
      { shallow: true },
    );
  });

  // The filter bar scopes all five tabs, so it sits outside the panels and has
  // to stay mounted no matter which one is open.
  it('keeps the filter bar mounted across tabs', () => {
    renderWithTab('people');

    expect(screen.getByTestId('time-range-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-group-input')).toBeInTheDocument();
    expect(screen.getByTestId('user-input')).toBeInTheDocument();
  });

  // Gating each query on its owning tab is what keeps opening the studio from
  // firing all fourteen fetches at once.
  it('only enables the queries belonging to the open tab', () => {
    renderWithTab('knowledge');

    // Last arg is the `enabled` flag each hook forwards to react-query.
    expect(useGetGraphStats).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), true,
    );
    expect(useGetArtifactStats).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(), false,
    );
  });

  // Mantine keeps hidden tab panels mounted, so section-level search hooks
  // need their own `enabled` gate too — not just the top-level tab check.
  it('gates the section-level searches on their own tab too', () => {
    renderWithTab('activity');

    // Second arg is the `enabled` flag each search hook forwards to react-query.
    expect(useSearchChats).toHaveBeenCalledWith(expect.anything(), false);
    expect(useSearchDocuments).toHaveBeenCalledWith(expect.anything(), false);
    expect(useSearchUsers).toHaveBeenCalledWith(expect.anything(), false);
    expect(useSearchArtifacts).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('enables a section search once its tab is open', () => {
    renderWithTab('people');

    expect(useSearchUsers).toHaveBeenCalledWith(expect.anything(), false);
    act(() => { jest.runAllTimers(); });
    expect(useSearchUsers).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(useSearchDocuments).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  // Both the conversations table and the artifacts browse table live under the
  // conversations tab, so opening it must enable both of their searches.
  it('enables both conversations searches on the conversations tab', () => {
    renderWithTab('conversations');

    act(() => { jest.runAllTimers(); });
    expect(useSearchChats).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(useSearchArtifacts).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  const chatRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'chat-1',
    userName: 'Test User',
    userEmail: 'test@example.com',
    summary: 'Test summary',
    createdAt: new Date('2026-08-03T14:46:29Z'),
    documents: [],
    graphDocuments: [],
    attachedDocuments: [],
    artifacts: [],
    artifactDetails: [],
    messages: [],
    graphAnchorCitations: 0,
    sessionLength: null,
    ...overrides,
  });

  it('shows the total time spent and expands to the individual visits', () => {
    (useSearchChats as jest.Mock).mockReturnValue({
      data: {
        records: [chatRecord({
          sessionLength: {
            totalDurationMs: 330_000,
            visits: [
              { enteredAt: new Date('2026-08-03T14:46:29Z'), leftAt: new Date('2026-08-03T14:51:29Z'), durationMs: 300_000 },
              { enteredAt: new Date('2026-08-03T15:00:00Z'), leftAt: new Date('2026-08-03T15:00:30Z'), durationMs: 30_000 },
            ],
          },
        })],
        totalCount: 1,
      },
      isFetching: false,
      isPending: false,
    });

    renderWithTab('conversations');
    act(() => { jest.runAllTimers(); });

    expect(screen.getByTestId('session-length-total')).toHaveTextContent('5m 30s');
    expect(screen.getByTestId('session-length-toggle')).toHaveTextContent('2 visits');
    expect(screen.queryByTestId('session-length-visits')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('session-length-toggle'));

    expect(screen.getByTestId('session-length-toggle')).toHaveTextContent('Hide visits');
    expect(screen.getAllByTestId('session-length-visit')).toHaveLength(2);
  });

  // A single visit has nothing to expand into, so the toggle must not render.
  it('omits the visits toggle for a chat with a single visit', () => {
    (useSearchChats as jest.Mock).mockReturnValue({
      data: {
        records: [chatRecord({
          sessionLength: {
            totalDurationMs: 45_000,
            visits: [
              { enteredAt: new Date('2026-08-03T14:46:29Z'), leftAt: new Date('2026-08-03T14:47:14Z'), durationMs: 45_000 },
            ],
          },
        })],
        totalCount: 1,
      },
      isFetching: false,
      isPending: false,
    });

    renderWithTab('conversations');
    act(() => { jest.runAllTimers(); });

    expect(screen.getByTestId('session-length-total')).toHaveTextContent('45s');
    expect(screen.queryByTestId('session-length-toggle')).not.toBeInTheDocument();
  });

  // No click-based navigation was ever recorded for this chat (e.g. reload or
  // direct URL entry), which reads as unknown rather than a zero duration.
  it('shows a dash when a chat has no recorded session length', () => {
    (useSearchChats as jest.Mock).mockReturnValue({
      data: { records: [chatRecord({ sessionLength: null })], totalCount: 1 },
      isFetching: false,
      isPending: false,
    });

    renderWithTab('conversations');
    act(() => { jest.runAllTimers(); });

    expect(screen.getByTestId('session-length-empty')).toBeInTheDocument();
  });

  describe('Artifacts table', () => {
    const artifactRow = {
      id: 'chat-artifact-1',
      name: 'Report.html',
      source: 'chat' as const,
      userName: 'Chat User',
      workflowName: null,
      createdAt: new Date('2026-06-01'),
      cost: 0.02,
      tokens: 1500,
      cumulativeCost: 0.05,
      cumulativeTokens: 4000,
      sizeBytes: 2048,
    };

    beforeEach(() => {
      (useSearchArtifacts as jest.Mock).mockReturnValue({
        data: { records: [artifactRow], totalCount: 1, typeCounts: { '.html': 1 } },
        isFetching: false,
        isPending: false,
      });
      // The table renders behind an `artifactStats` truthy check shared with the
      // stat strip above it, so an empty-but-defined stats object is required
      // even though this describe block only asserts on the row-level table.
      (useGetArtifactStats as jest.Mock).mockReturnValue({
        data: {
          total: 1,
          chat: 1,
          workflow: 0,
          byType: [],
          chatArtifacts: {
            total: 1,
            byType: [],
            byCreationMethod: {
              modelOnly: { total: 0, byModel: [] },
              agentProvider: { total: 0, byAgentProvider: [] },
            },
          },
          workflowArtifacts: { total: 0, byType: [] },
        },
        isFetching: false,
      });
    });

    it('shows a formatted file size next to the cost columns', () => {
      renderWithTab('conversations');
      act(() => { jest.runAllTimers(); });

      expect(screen.getByTestId('artifacts-cost-token-header')).toBeInTheDocument();
      expect(screen.getByTestId('artifact-size-chat-artifact-1')).toHaveTextContent('2.0 KB');
    });

    it('downloads the artifact when the download button is clicked', async () => {
      mockGetArtifactContentFetch.mockResolvedValue({
        label: 'Report',
        fileExtension: '.html',
        content: '<p>hi</p>',
        binaryContent: null,
      });

      renderWithTab('conversations');
      act(() => { jest.runAllTimers(); });

      const createObjectURLMock = jest.fn(() => 'blob:mock-url');
      const revokeObjectURLMock = jest.fn();
      const mockClick = jest.fn();
      global.URL.createObjectURL = createObjectURLMock;
      global.URL.revokeObjectURL = revokeObjectURLMock;
      const mockAnchor = { click: mockClick, href: '', download: '' } as unknown as HTMLAnchorElement;
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockAnchor);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mockAnchor);
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mockAnchor);

      const downloadButton = screen.getByTestId(`artifact-download-${artifactRow.id}`);
      await act(async () => {
        fireEvent.click(downloadButton);
        await Promise.resolve();
      });

      expect(mockGetArtifactContentFetch).toHaveBeenCalledWith({ source: 'chat', id: 'chat-artifact-1' });
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });

  describe('Agent Proposals loading', () => {
    it('loads proposal jobs when the Agents tab is active', () => {
      renderWithTab('ai-agents');

      expect(useGetAgentProposalJobs).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), true,
      );
    });

    it('does not load proposal jobs on other tabs', () => {

      renderWithTab('conversations');

      expect(useGetAgentProposalJobs).toHaveBeenCalledWith(
        expect.anything(), expect.anything(), expect.anything(), false,
      );
    });
  });
});

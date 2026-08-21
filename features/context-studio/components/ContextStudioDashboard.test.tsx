import { act, render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/router';
import ContextStudioDashboard from './ContextStudioDashboard';
import useGetActivityStrips from '@/features/context-studio/api/get-activity-strips';
import useGetArtifactStats from '@/features/context-studio/api/get-artifact-stats';
import useGetGraphStats from '@/features/context-studio/api/get-graph-stats';
import useSearchChats from '@/features/context-studio/api/search-chats';
import useSearchDocuments from '@/features/context-studio/api/search-documents';
import useSearchUsers from '@/features/context-studio/api/search-users';
import useSearchWorkflowArtifacts from '@/features/context-studio/api/search-workflow-artifacts';

// The tab strip is what's under test, so the panels are stubbed down to a marker
// each. That keeps the assertions about which sections a tab reveals, rather
// than about how any one section renders.
jest.mock('./panels/AgentsPanel', () => {
  return function AgentsPanel() {
    return <div data-testid='agents-panel' />;
  };
});

jest.mock('./sections/ActivityStrips', () => {
  return function ActivityStrips() {
    return <div data-testid='activity-strips' />;
  };
});

jest.mock('./sections/SessionPathLanes', () => {
  return function SessionPathLanes() {
    return <div data-testid='session-path-lanes' />;
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

jest.mock('@/features/context-studio/api/get-session-path-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false })),
}));

jest.mock('@/features/context-studio/api/get-activity-strips', () => ({
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

jest.mock('@/features/context-studio/api/search-workflow-artifacts', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined, isFetching: false, isPending: true })),
}));

describe('ContextStudioDashboard', () => {
  const push = jest.fn();

  const renderWithTab = (tab?: string) => {
    (useRouter as jest.Mock).mockReturnValue({
      query: tab ? { tab } : {},
      pathname: '/context-studio',
      push,
    });
    return render(<ContextStudioDashboard />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders every tab in the strip', () => {
    renderWithTab();

    ['activity', 'conversations', 'knowledge', 'ai-agents', 'people', 'cost'].forEach((tab) => {
      expect(screen.getByTestId(`context-studio-${tab}-tab`)).toBeInTheDocument();
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

  it('opens on Activity when the URL names no tab', () => {
    renderWithTab();

    expect(screen.getByTestId('context-studio-activity-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('activity-strips')).toBeInTheDocument();
  });

  it('opens the tab named in the URL, so a view is linkable', () => {
    renderWithTab('ai-agents');

    expect(screen.getByTestId('context-studio-ai-agents-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('agents-panel')).toBeInTheDocument();
  });

  // An unknown tab param would otherwise select nothing and render an empty
  // shell, which reads as a broken page rather than a bad link.
  it('falls back to Activity when the URL names an unknown tab', () => {
    renderWithTab('nonsense');

    expect(screen.getByTestId('context-studio-activity-tab')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('activity-strips')).toBeInTheDocument();
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
    expect(useGetActivityStrips).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.anything(), expect.anything(), false,
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
    expect(useSearchWorkflowArtifacts).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('enables a section search once its tab is open', () => {
    renderWithTab('people');

    expect(useSearchUsers).toHaveBeenCalledWith(expect.anything(), false);
    act(() => { jest.runAllTimers(); });
    expect(useSearchUsers).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(useSearchDocuments).toHaveBeenLastCalledWith(expect.anything(), false);
  });

  // Both the conversations searches belong to the same tab, and the artifacts
  // section reuses the chat search, so opening that tab must enable both.
  it('enables both conversations searches on the conversations tab', () => {
    renderWithTab('conversations');

    act(() => { jest.runAllTimers(); });
    expect(useSearchChats).toHaveBeenLastCalledWith(expect.anything(), true);
    expect(useSearchWorkflowArtifacts).toHaveBeenLastCalledWith(expect.anything(), true);
  });
});

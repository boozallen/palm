import NavigationLinks from './NavigationLinks';
import { useRouter } from 'next/router';
import { fireEvent } from '@testing-library/react';
import { renderWrapper } from '@/test/test-utils';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';
import { UiPreference } from '@/types/ui-preferences';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-user-enabled-ai-agents');
jest.mock('@/features/shared/api/get-user-workflows-access');

const mockCreateAuditRecord = jest.fn();

// Mock localStorage so prompt-tools expand/collapse persistence can be asserted on.
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('NavigationLinks', () => {
  const mockRouter = {
    push: jest.fn(),
    asPath: '/chat',
  };

  beforeEach(() => {
    localStorageMock.clear();
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: mockCreateAuditRecord });
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { featureManagementPromptGenerator: true },
      isPending: false,
    });

    (useGetUserEnabledAiAgents as jest.Mock).mockReturnValue({
      data: { enabledAiAgents: [] },
      isPending: false,
    });

    (useGetUserWorkflowsAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: false },
      isPending: false,
    });

    (useGetUserWorkflowsAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: false },
      isPending: false,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('uses the SafeExit component in each NavLink', () => {
    const { getAllByTestId } = renderWrapper(
      <NavigationLinks />
    );

    const linkElements = getAllByTestId('safeExit');
    linkElements.forEach((link) => {
      expect(link).toBeInTheDocument();
    });
  });

  it('should render Prompt Generator when system config enables it', () => {
    const { getByText } = renderWrapper(<NavigationLinks />);

    expect(getByText('Prompt Generator')).toBeInTheDocument();
  });

  it('should not render Prompt Generator when system config disables it', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { featureManagementPromptGenerator: false },
      isPending: false,
    });

    const { queryByText } = renderWrapper(<NavigationLinks />);

    expect(queryByText('Prompt Generator')).not.toBeInTheDocument();
  });

  it('renders ai agents link', () => {
    (useGetUserEnabledAiAgents as jest.Mock).mockReturnValue({
      data: { enabledAiAgents: [{ id: '1', label: 'Test Agent' }] },
      isPending: false,
    });
    
    const { getByText } = renderWrapper(
      <NavigationLinks />
    );

    const aiAgentsLink = getByText('AI Agents');
    expect(aiAgentsLink).toBeInTheDocument();
  });

  it('does not render ai agents link when no agents are enabled for a user', () => {
    (useGetUserEnabledAiAgents as jest.Mock).mockReturnValue({
      data: { enabledAiAgents: [] },
      isPending: false,
    });

    const { queryByText } = renderWrapper(
      <NavigationLinks />
    );

    expect(queryByText('AI Agents')).not.toBeInTheDocument();
  });

  it.skip('renders workflows link when user has access', () => {
    (useGetUserWorkflowsAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: true },
      isPending: false,
    });
    
    const { getByText } = renderWrapper(
      <NavigationLinks />
    );

    const workflowsLink = getByText('Workflows');
    expect(workflowsLink).toBeInTheDocument();
  });

  it('does not render workflows link when user does not have access', () => {
    (useGetUserWorkflowsAccess as jest.Mock).mockReturnValue({
      data: { hasAccess: false },
      isPending: false,
    });

    const { queryByText } = renderWrapper(
      <NavigationLinks />
    );

    expect(queryByText('Workflows')).not.toBeInTheDocument();
  });

  describe('prompt tools group', () => {
    it('renders the prompt tools toggle collapsed by default', () => {
      const { getByTestId } = renderWrapper(<NavigationLinks />);

      expect(getByTestId('prompt-tools-nav-chevron')).toHaveStyle({ transform: 'rotate(0deg)' });
    });

    it('expands the prompt tools group and persists the state when the toggle is clicked', () => {
      const { getByTestId } = renderWrapper(<NavigationLinks />);

      fireEvent.click(getByTestId('prompt-tools-nav-toggle'));

      expect(getByTestId('prompt-tools-nav-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
      expect(localStorageMock.setItem).toHaveBeenCalledWith(UiPreference.PROMPT_TOOLS_NAV_EXPANDED, 'true');
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Expand prompt tools nav group',
      });
    });

    it('collapses the prompt tools group again on a second click', () => {
      const { getByTestId } = renderWrapper(<NavigationLinks />);

      fireEvent.click(getByTestId('prompt-tools-nav-toggle'));
      fireEvent.click(getByTestId('prompt-tools-nav-toggle'));

      expect(getByTestId('prompt-tools-nav-chevron')).toHaveStyle({ transform: 'rotate(0deg)' });
      expect(localStorageMock.setItem).toHaveBeenLastCalledWith(UiPreference.PROMPT_TOOLS_NAV_EXPANDED, 'false');
      expect(mockCreateAuditRecord).toHaveBeenLastCalledWith({
        event: AuditRecordEvent.TogglePanel,
        label: 'Collapse prompt tools nav group',
      });
    });

    it('restores a previously expanded state from localStorage on mount', () => {
      localStorageMock.setItem(UiPreference.PROMPT_TOOLS_NAV_EXPANDED, 'true');

      const { getByTestId } = renderWrapper(<NavigationLinks />);

      expect(getByTestId('prompt-tools-nav-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
    });

    it('auto-expands when the current route is a prompt tool page, without persisting it', () => {
      (useRouter as jest.Mock).mockReturnValue({ ...mockRouter, asPath: '/library' });

      const { getByTestId } = renderWrapper(<NavigationLinks />);

      expect(getByTestId('prompt-tools-nav-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    describe('in the collapsed (icon-rail) sidebar', () => {
      // Chat only, with the default mocks (no AI Agents access, no Workflows access).
      const primaryLinkCount = 1;
      // Prompt Library, Prompt Generator (enabled by default mock), Prompt Playground.
      const promptToolLinkCount = 3;

      it('hides the prompt tool links when the setting is collapsed', () => {
        const { getAllByTestId } = renderWrapper(<NavigationLinks isCollapsed />);

        expect(getAllByTestId('safeExit')).toHaveLength(primaryLinkCount);
      });

      it('shows the prompt tool links when the setting is expanded', () => {
        localStorageMock.setItem(UiPreference.PROMPT_TOOLS_NAV_EXPANDED, 'true');

        const { getAllByTestId } = renderWrapper(<NavigationLinks isCollapsed />);

        expect(getAllByTestId('safeExit')).toHaveLength(primaryLinkCount + promptToolLinkCount);
      });

      it('shows the prompt tool links when on a prompt tool route, even with the setting collapsed', () => {
        (useRouter as jest.Mock).mockReturnValue({ ...mockRouter, asPath: '/library' });

        const { getAllByTestId } = renderWrapper(<NavigationLinks isCollapsed />);

        expect(getAllByTestId('safeExit')).toHaveLength(primaryLinkCount + promptToolLinkCount);
      });
    });
  });
});

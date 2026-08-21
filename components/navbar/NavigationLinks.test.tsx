import NavigationLinks from './NavigationLinks';
import { useRouter } from 'next/router';
import { renderWrapper } from '@/test/test-utils';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';
import { useGetUserWorkflowsAccess } from '@/features/shared/api/get-user-workflows-access';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-user-enabled-ai-agents');
jest.mock('@/features/shared/api/get-user-workflows-access');

describe('NavigationLinks', () => {
  const mockRouter = {
    push: jest.fn(),
  };

  beforeEach(() => {
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
});

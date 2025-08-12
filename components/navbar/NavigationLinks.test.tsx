import NavigationLinks from './NavigationLinks';
import { useRouter } from 'next/router';
import { renderWrapper } from '@/test/test-utils';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetUserEnabledAiAgents from '@/features/shared/api/get-user-enabled-ai-agents';
import { render } from '@testing-library/react';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-user-enabled-ai-agents');

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
    const { getByText } = render(<NavigationLinks />);

    expect(getByText('Prompt Generator')).toBeInTheDocument();
  });

  it('should not render Prompt Generator when system config disables it', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { featureManagementPromptGenerator: false },
      isPending: false,
    });

    const { queryByText } = render(<NavigationLinks />);

    expect(queryByText('Prompt Generator')).not.toBeInTheDocument();
  });

  it('renders ai agents link', () => {
    (useGetUserEnabledAiAgents as jest.Mock).mockReturnValue({
      data: { enabledAiAgents: [{ id: '1', name: 'Test Agent' }] },
      isPending: false,
    });
    
    const { getByText } = render(
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

    const { queryByText } = render(
      <NavigationLinks />
    );

    expect(queryByText('AI Agents')).not.toBeInTheDocument();
  });
});

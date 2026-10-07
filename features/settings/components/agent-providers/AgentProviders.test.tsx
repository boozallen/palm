import { fireEvent, render } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import AgentProviders from './AgentProviders';

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useDisclosure: jest.fn(),
}));

jest.mock('./tables/AgentProvidersTable', () => {
  return function MockedAgentProvidersTable() {
    return <div data-testid='agent-providers-table'></div>;
  };
});

jest.mock('./modals/AddAgentProviderModal', () => {
  return function MockedAddAgentProviderModal() {
    return <div data-testid='add-agent-provider-modal'></div>;
  };
});

describe('AgentProviders', () => {
  const openMock = jest.fn();
  const closeMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openMock, close: closeMock },
    ]);
  });

  it('renders without crashing', () => {
    const { container } = render(<AgentProviders />);
    expect(container).toBeTruthy();
  });

  it('renders header and add button', () => {
    const { getByText, getByTestId } = render(<AgentProviders />);

    expect(getByText('Agent Providers')).toBeInTheDocument();
    expect(getByTestId('add-agent-provider-button')).toBeInTheDocument();
  });

  it('opens the add modal when the add button is clicked', () => {
    const { getByTestId } = render(<AgentProviders />);

    fireEvent.click(getByTestId('add-agent-provider-button'));

    expect(openMock).toHaveBeenCalled();
  });

  it('renders the agent providers table', () => {
    const { getByTestId } = render(<AgentProviders />);

    expect(getByTestId('agent-providers-table')).toBeInTheDocument();
  });
});

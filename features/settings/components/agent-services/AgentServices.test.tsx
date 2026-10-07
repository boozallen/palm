import { render } from '@testing-library/react';
import AgentServices from './AgentServices';

jest.mock('./tables/AgentServicesTable', () => {
  return function MockedAgentServicesTable() {
    return <div data-testid='agent-services-table'></div>;
  };
});

describe('AgentServices', () => {
  it('renders without crashing', () => {
    const { container } = render(<AgentServices />);
    expect(container).toBeTruthy();
  });

  it('renders the header', () => {
    const { getByText } = render(<AgentServices />);
    expect(getByText('Agent Services')).toBeInTheDocument();
  });

  it('renders the agent services table', () => {
    const { getByTestId } = render(<AgentServices />);
    expect(getByTestId('agent-services-table')).toBeInTheDocument();
  });
});

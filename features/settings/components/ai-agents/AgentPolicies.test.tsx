import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import AgentPolicies from './AgentPolicies';

jest.mock('@mantine/hooks');
jest.mock('./tables/AgentPolicyTable', () => {
  return function MockAgentPolicyTable() {
    return <div>Agent Policy Table</div>;
  };
});

jest.mock('./modals/AddPolicyModal', () => {
  return function MockAddPolicyModal() {
    return <div>Add Policy Modal</div>;
  };
});

const mockAiAgentId = '7ea25422-a179-4798-94c7-32d315f1a3a9';

const renderComponent = () => {
  return render(
    <AgentPolicies aiAgentId={mockAiAgentId}/>
  );
};

describe('AgentPolicies', () => {
  const openModal = jest.fn();
  const closeModal = jest.fn();

  (useDisclosure as jest.Mock).mockReturnValue([
    false,
    { open: openModal, close: closeModal },
  ]);

  beforeEach(jest.clearAllMocks);

  it('renders title', () => {
    renderComponent();

    expect(screen.getByText('Policies')).toBeInTheDocument();
  });

  it('renders action icon', () => {
    renderComponent();

    expect(screen.getByLabelText('Add New Policy')).toBeInTheDocument();
  });

  it('renders modal', () => {
    renderComponent();

    expect(screen.getByText('Add Policy Modal')).toBeInTheDocument();
  });

  it('opens the modal when the action icon is clicked', () => {
    renderComponent();

    const actionIcon = screen.getByLabelText('Add New Policy');
    actionIcon.click();

    expect(openModal).toHaveBeenCalled();
  });

  it('renders agent policy table', () => {
    renderComponent();

    expect(screen.getByText('Agent Policy Table')).toBeInTheDocument();
  });
});

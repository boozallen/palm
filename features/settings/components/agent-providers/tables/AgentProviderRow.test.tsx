import { fireEvent, render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import AgentProviderRow from './AgentProviderRow';

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useDisclosure: jest.fn(),
}));

jest.mock('../modals/EditAgentProviderModal', () => {
  return function MockedEditAgentProviderModal({ modalOpen }: { modalOpen: boolean }) {
    return modalOpen ? <div data-testid='edit-modal'>Edit Modal</div> : null;
  };
});

jest.mock('../modals/DeleteAgentProviderModal', () => {
  return function MockedDeleteAgentProviderModal({ modalOpen }: { modalOpen: boolean }) {
    return modalOpen ? <div data-testid='delete-modal'>Delete Modal</div> : null;
  };
});

jest.mock('../menus/AgentProviderActionsMenu', () => ({
  AgentProviderActionsMenu: function MockedAgentProviderActionsMenu({
    onEditClick,
    onDeleteClick,
  }: {
    onEditClick: () => void;
    onDeleteClick: () => void;
  }) {
    return (
      <div>
        <button onClick={onEditClick}>Edit</button>
        <button onClick={onDeleteClick}>Delete</button>
      </div>
    );
  },
}));

describe('AgentProviderRow', () => {
  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    name: 'Test Agent',
    description: 'A test agent',
    endpoint: 'https://agent.example.com',
  };

  const openEditMock = jest.fn();
  const closeEditMock = jest.fn();
  const openDeleteMock = jest.fn();
  const closeDeleteMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock)
      .mockReturnValueOnce([false, { open: openEditMock, close: closeEditMock }])
      .mockReturnValueOnce([false, { open: openDeleteMock, close: closeDeleteMock }]);
  });

  it('renders the provider name, description, and endpoint', () => {
    render(
      <table>
        <tbody>
          <AgentProviderRow provider={mockProvider} />
        </tbody>
      </table>
    );

    expect(screen.getByText(mockProvider.name)).toBeInTheDocument();
    expect(screen.getByText(mockProvider.description)).toBeInTheDocument();
    expect(screen.getByText(mockProvider.endpoint)).toBeInTheDocument();
  });

  it('opens the edit modal when Edit is clicked', () => {
    render(
      <table>
        <tbody>
          <AgentProviderRow provider={mockProvider} />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText('Edit'));

    expect(openEditMock).toHaveBeenCalled();
  });

  it('opens the delete modal when Delete is clicked', () => {
    render(
      <table>
        <tbody>
          <AgentProviderRow provider={mockProvider} />
        </tbody>
      </table>
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(openDeleteMock).toHaveBeenCalled();
  });

  it('shows a dash when description is empty', () => {
    render(
      <table>
        <tbody>
          <AgentProviderRow provider={{ ...mockProvider, description: '' }} />
        </tbody>
      </table>
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});

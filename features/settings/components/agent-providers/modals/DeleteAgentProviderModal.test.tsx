import { render, screen, fireEvent } from '@testing-library/react';
import DeleteAgentProviderModal from './DeleteAgentProviderModal';
import useDeleteAgentProvider from '@/features/settings/api/agent-providers/delete-agent-provider';

jest.mock('@/features/settings/api/agent-providers/delete-agent-provider');

describe('DeleteAgentProviderModal', () => {
  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    name: 'Test Agent',
  };

  const closeModalHandler = jest.fn();
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useDeleteAgentProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
    });
  });

  it('renders the modal with title and confirmation text', () => {
    render(
      <DeleteAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(screen.getByText('Delete Agent Provider')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete this Agent Provider?')).toBeInTheDocument();
  });

  it('calls closeModalHandler when Cancel is clicked', () => {
    render(
      <DeleteAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls mutateAsync with provider id when Delete Provider is clicked', async () => {
    mockMutateAsync.mockResolvedValue({});

    render(
      <DeleteAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    fireEvent.click(screen.getByText('Delete Provider'));

    expect(mockMutateAsync).toHaveBeenCalledWith({ id: mockProvider.id });
  });

  it('returns null when agentProvider is null', () => {
    const { container } = render(
      <DeleteAgentProviderModal
        agentProvider={null}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

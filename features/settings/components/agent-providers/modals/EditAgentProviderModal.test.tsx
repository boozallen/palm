import { render, screen, fireEvent } from '@testing-library/react';
import EditAgentProviderModal from './EditAgentProviderModal';

jest.mock('../forms/EditAgentProviderForm', () => {
  return function MockedEditAgentProviderForm({ setFormCompleted }: { setFormCompleted: (v: boolean) => void }) {
    return (
      <button onClick={() => setFormCompleted(true)}>
        Submit Form
      </button>
    );
  };
});

describe('EditAgentProviderModal', () => {
  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    name: 'Test Agent',
    description: 'A test agent',
    endpoint: 'https://agent.example.com',
  };

  const closeModalHandler = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the modal with correct title when open', () => {
    render(
      <EditAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(screen.getByText('Edit Agent Provider')).toBeInTheDocument();
  });

  it('does not render modal content when closed', () => {
    render(
      <EditAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={false}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(screen.queryByText('Edit Agent Provider')).not.toBeInTheDocument();
  });

  it('returns null when agentProvider is null', () => {
    const { container } = render(
      <EditAgentProviderModal
        agentProvider={null}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('calls closeModalHandler when the form completes', () => {
    render(
      <EditAgentProviderModal
        agentProvider={mockProvider}
        modalOpen={true}
        closeModalHandler={closeModalHandler}
      />
    );

    fireEvent.click(screen.getByText('Submit Form'));

    expect(closeModalHandler).toHaveBeenCalled();
  });
});

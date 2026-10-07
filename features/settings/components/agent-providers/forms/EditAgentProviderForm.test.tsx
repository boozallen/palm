import { render, screen, fireEvent } from '@testing-library/react';
import EditAgentProviderForm from './EditAgentProviderForm';
import useUpdateAgentProvider from '@/features/settings/api/agent-providers/update-agent-provider';

jest.mock('@/features/settings/api/agent-providers/update-agent-provider');

describe('EditAgentProviderForm', () => {
  const mockProvider = {
    id: '4a8f5b8d-8bf4-4e1d-9c9b-5357698f8c09',
    name: 'Test Agent',
    description: 'A test agent',
    endpoint: 'https://agent.example.com',
  };

  const mockMutate = jest.fn();
  const setFormCompleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useUpdateAgentProvider as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders the form pre-filled with provider data', () => {
    render(
      <EditAgentProviderForm
        agentProvider={mockProvider}
        setFormCompleted={setFormCompleted}
      />
    );

    expect(screen.getByDisplayValue(mockProvider.name)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockProvider.endpoint)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('calls mutate with updated values on valid submission', () => {
    render(
      <EditAgentProviderForm
        agentProvider={mockProvider}
        setFormCompleted={setFormCompleted}
      />
    );

    fireEvent.change(screen.getByDisplayValue(mockProvider.name), {
      target: { value: 'Updated Agent' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mockProvider.id,
        name: 'Updated Agent',
        endpoint: mockProvider.endpoint,
      }),
      expect.any(Object)
    );
  });

  it('does not call mutate when name is cleared', () => {
    render(
      <EditAgentProviderForm
        agentProvider={mockProvider}
        setFormCompleted={setFormCompleted}
      />
    );

    fireEvent.change(screen.getByDisplayValue(mockProvider.name), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows loading state on the submit button when pending', () => {
    (useUpdateAgentProvider as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    render(
      <EditAgentProviderForm
        agentProvider={mockProvider}
        setFormCompleted={setFormCompleted}
      />
    );

    const button = screen.getByRole('button', { name: /save changes/i });
    expect(button).toHaveAttribute('data-loading', 'true');
  });
});

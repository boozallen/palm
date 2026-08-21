import { render, screen, fireEvent } from '@testing-library/react';
import AddAgentProviderForm from './AddAgentProviderForm';
import useAddAgentProvider from '@/features/settings/api/agent-providers/add-agent-provider';

jest.mock('@/features/settings/api/agent-providers/add-agent-provider');

describe('AddAgentProviderForm', () => {
  const mockMutate = jest.fn();
  const setFormCompleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useAddAgentProvider as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  it('renders all form fields and submit button', () => {
    render(<AddAgentProviderForm setFormCompleted={setFormCompleted} />);

    expect(screen.getByPlaceholderText('My Agent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://agent.example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add agent provider/i })).toBeInTheDocument();
  });

  it('calls mutate with trimmed form values on valid submission', () => {
    render(<AddAgentProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('My Agent'), {
      target: { value: '  Test Agent  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://agent.example.com'), {
      target: { value: 'https://agent.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add agent provider/i }));

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Agent',
        endpoint: 'https://agent.example.com',
      }),
      expect.any(Object)
    );
  });

  it('does not call mutate when name is empty', () => {
    render(<AddAgentProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('https://agent.example.com'), {
      target: { value: 'https://agent.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add agent provider/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('does not call mutate when endpoint is not a valid URL', () => {
    render(<AddAgentProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('My Agent'), {
      target: { value: 'Test Agent' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://agent.example.com'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add agent provider/i }));

    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('shows loading state on the submit button when pending', () => {
    (useAddAgentProvider as jest.Mock).mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    render(<AddAgentProviderForm setFormCompleted={setFormCompleted} />);

    const button = screen.getByRole('button', { name: /add agent provider/i });
    expect(button).toHaveAttribute('data-loading', 'true');
  });
});

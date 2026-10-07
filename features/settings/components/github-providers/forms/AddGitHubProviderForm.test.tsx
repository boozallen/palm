import { render, screen, fireEvent } from '@testing-library/react';
import AddGitHubProviderForm from './AddGitHubProviderForm';
import useAddGitHubProvider from '@/features/settings/api/github-providers/add-github-provider';

jest.mock('@/features/settings/api/github-providers/add-github-provider');

describe('AddGitHubProviderForm', () => {
  const mockMutateAsync = jest.fn();
  const setFormCompleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
    (useAddGitHubProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
      isPending: false,
    });
  });

  it('renders all form fields and the submit button', () => {
    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    expect(screen.getByPlaceholderText('Production Artifacts')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('https://api.github.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('myorg')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('my-repo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add github provider/i })).toBeInTheDocument();
  });

  it('calls mutateAsync with trimmed form values on valid submission', () => {
    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('Production Artifacts'), {
      target: { value: '  My Provider  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx'), {
      target: { value: '  ghp_abc123  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('myorg'), {
      target: { value: 'myorg' },
    });
    fireEvent.change(screen.getByPlaceholderText('my-repo'), {
      target: { value: 'my-repo' },
    });

    fireEvent.click(screen.getByRole('button', { name: /add github provider/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'My Provider',
        accessToken: 'ghp_abc123',
        apiBaseUrl: 'https://api.github.com',
        owner: 'myorg',
        repo: 'my-repo',
      }),
    );
  });

  it('does not call mutateAsync when label is empty', () => {
    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx'), {
      target: { value: 'ghp_abc123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add github provider/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not call mutateAsync when access token is empty', () => {
    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('Production Artifacts'), {
      target: { value: 'My Provider' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add github provider/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not call mutateAsync when apiBaseUrl is not a valid URL', () => {
    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    fireEvent.change(screen.getByPlaceholderText('Production Artifacts'), {
      target: { value: 'My Provider' },
    });
    fireEvent.change(screen.getByPlaceholderText('ghp_xxxxxxxxxxxxxxxxxxxx'), {
      target: { value: 'ghp_abc123' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://api.github.com'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add github provider/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows loading state on the submit button when pending', () => {
    (useAddGitHubProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
      isPending: true,
    });

    render(<AddGitHubProviderForm setFormCompleted={setFormCompleted} />);

    expect(screen.getByRole('button', { name: /add github provider/i })).toHaveAttribute(
      'data-loading',
      'true',
    );
  });
});

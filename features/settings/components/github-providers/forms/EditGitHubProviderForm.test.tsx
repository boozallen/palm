import { render, screen, fireEvent } from '@testing-library/react';
import EditGitHubProviderForm from './EditGitHubProviderForm';
import useUpdateGitHubProvider from '@/features/settings/api/github-providers/update-github-provider';

jest.mock('@/features/settings/api/github-providers/update-github-provider');

describe('EditGitHubProviderForm', () => {
  const mockMutateAsync = jest.fn();
  const setFormCompleted = jest.fn();

  const defaultProps = {
    providerId: 'provider-uuid-1',
    currentLabel: 'My Provider',
    currentApiBaseUrl: 'https://api.github.com',
    currentOwner: 'myorg',
    currentRepo: 'my-repo',
    currentDescription: 'A test provider',
    currentIsSkillRepo: false,
    currentSkillRepoBranch: null as string | null,
    currentSkillRepoServiceUrl: null as string | null,
    setFormCompleted,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockResolvedValue(undefined);
    (useUpdateGitHubProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
      isPending: false,
    });
  });

  it('renders the form pre-filled with current provider values', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    expect(screen.getByDisplayValue('My Provider')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.github.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test provider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update github provider/i })).toBeInTheDocument();
  });

  it('calls mutateAsync with updated values on valid submission', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    fireEvent.change(screen.getByDisplayValue('My Provider'), {
      target: { value: 'Updated Provider' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update github provider/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-uuid-1',
        label: 'Updated Provider',
        apiBaseUrl: 'https://api.github.com',
        owner: 'myorg',
        repo: 'my-repo',
      }),
    );
  });

  it('sends accessToken as undefined when left blank', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /update github provider/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: undefined }),
    );
  });

  it('sends accessToken when filled in', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    fireEvent.change(screen.getByPlaceholderText('Leave blank to keep existing token'), {
      target: { value: 'ghp_newtoken' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update github provider/i }));

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'ghp_newtoken' }),
    );
  });

  it('does not call mutateAsync when label is cleared', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    fireEvent.change(screen.getByDisplayValue('My Provider'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /update github provider/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('does not call mutateAsync when apiBaseUrl is not a valid URL', () => {
    render(<EditGitHubProviderForm {...defaultProps} />);

    fireEvent.change(screen.getByDisplayValue('https://api.github.com'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update github provider/i }));

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('shows loading state on the submit button when pending', () => {
    (useUpdateGitHubProvider as jest.Mock).mockReturnValue({
      mutateAsync: mockMutateAsync,
      error: null,
      isPending: true,
    });

    render(<EditGitHubProviderForm {...defaultProps} />);

    expect(screen.getByRole('button', { name: /update github provider/i })).toHaveAttribute(
      'data-loading',
      'true',
    );
  });
});

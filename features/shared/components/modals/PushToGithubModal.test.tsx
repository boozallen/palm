import { render, fireEvent, screen } from '@testing-library/react';
import PushToGithubModal from './PushToGithubModal';
import { UiPreference } from '@/types/ui-preferences';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: mockCreateAuditRecord })),
}));

describe('PushToGithubModal', () => {
  const mockProviders = [
    {
      id: 'provider-1',
      label: 'GitHub',
      apiBaseUrl: 'https://api.github.com',
      owner: 'myorg',
      repo: 'my-repo',
    },
  ];

  const defaultProps = {
    modalOpened: true,
    closeModalHandler: jest.fn(),
    onConfirm: jest.fn(),
    providers: mockProviders,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders modal when opened', () => {
    const { getByRole } = render(<PushToGithubModal {...defaultProps} />);
    expect(getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the provider name as a read-only field when only one provider', () => {
    render(<PushToGithubModal {...defaultProps} />);
    expect(screen.getByDisplayValue('GitHub')).toBeInTheDocument();
  });

  it('displays visibility disclaimer referencing the provider instance', () => {
    render(<PushToGithubModal {...defaultProps} />);
    expect(screen.getByTestId('github-push-disclaimer')).toBeInTheDocument();
  });

  it('calls closeModalHandler when Cancel button is clicked', () => {
    const { getByRole } = render(<PushToGithubModal {...defaultProps} />);
    const cancelButton = getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    expect(defaultProps.closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with provider id when Push to GitHub button is clicked', () => {
    render(<PushToGithubModal {...defaultProps} />);

    const pushButton = screen.getByRole('button', { name: /push to github/i });
    fireEvent.click(pushButton);

    expect(defaultProps.onConfirm).toHaveBeenCalledWith('provider-1');
  });

  it('disables Push button when no provider is selected and multiple providers exist', () => {
    render(
      <PushToGithubModal
        {...defaultProps}
        providers={[
          ...mockProviders,
          { id: 'provider-2', label: 'Enterprise', apiBaseUrl: 'https://github.enterprise.com/api/v3', owner: 'org2', repo: 'repo2' },
        ]}
      />,
    );
    const pushButton = screen.getByRole('button', { name: /push to github/i });
    expect(pushButton).toBeDisabled();
  });

  it('disables buttons when isLoading is true', () => {
    const { getByRole } = render(
      <PushToGithubModal {...defaultProps} isLoading={true} />,
    );
    const cancelButton = getByRole('button', { name: /cancel/i });
    const pushButton = getByRole('button', { name: /push to github/i });
    expect(cancelButton).toBeDisabled();
    expect(pushButton).toBeDisabled();
  });

  it('stores true in localStorage when checkbox is checked and Push button is clicked', () => {
    const { getByLabelText } = render(<PushToGithubModal {...defaultProps} />);
    const checkbox = getByLabelText('Do not show this message again');

    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /push to github/i }));

    expect(localStorage.getItem(UiPreference.SUPPRESS_GITHUB_PUSH_WARNING)).toBe('true');
  });

  it('does not write to localStorage when checkbox is checked but Cancel is clicked', () => {
    const { getByLabelText, getByRole } = render(<PushToGithubModal {...defaultProps} />);
    const checkbox = getByLabelText('Do not show this message again');

    fireEvent.click(checkbox);
    fireEvent.click(getByRole('button', { name: /cancel/i }));

    expect(localStorage.getItem(UiPreference.SUPPRESS_GITHUB_PUSH_WARNING)).toBeNull();
  });

  it('does not write to localStorage when Push button is clicked without checking the checkbox', () => {
    render(<PushToGithubModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /push to github/i }));

    expect(localStorage.getItem(UiPreference.SUPPRESS_GITHUB_PUSH_WARNING)).toBeNull();
  });

  it('records an external navigation when the repository link is clicked', () => {
    render(<PushToGithubModal {...defaultProps} />);

    fireEvent.click(screen.getByText('https://github.com/myorg/my-repo'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'GitHub repository',
      href: 'https://github.com/myorg/my-repo',
    });
  });

  it('does not render modal when modalOpened is false', () => {
    const { queryByRole } = render(
      <PushToGithubModal {...defaultProps} modalOpened={false} />,
    );
    expect(queryByRole('dialog')).not.toBeInTheDocument();
  });
});

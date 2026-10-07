import { fireEvent, render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import GitHubProviderRow from './GitHubProviderRow';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

const mockCreateAuditRecord = jest.fn();

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: mockCreateAuditRecord })),
}));

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useDisclosure: jest.fn(),
}));

jest.mock('@mantine/notifications', () => ({
  notifications: { show: jest.fn() },
}));

jest.mock('@/features/settings/api/github-providers/refresh-repo', () => ({
  __esModule: true,
  default: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../modals/EditGitHubProviderModal', () => {
  return function MockedEditGitHubProviderModal({ modalOpen }: { modalOpen: boolean }) {
    return modalOpen ? <div data-testid='edit-modal'>Edit Modal</div> : null;
  };
});

jest.mock('../modals/DeleteGitHubProviderModal', () => {
  return function MockedDeleteGitHubProviderModal({ modalOpened }: { modalOpened: boolean }) {
    return modalOpened ? <div data-testid='delete-modal'>Delete Modal</div> : null;
  };
});

jest.mock('../menus/GitHubProviderActionsMenu', () => ({
  GitHubProviderActionsMenu: function MockedGitHubProviderActionsMenu({
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

describe('GitHubProviderRow', () => {
  const mockProvider = {
    id: 'provider-uuid-1',
    label: 'My Provider',
    apiBaseUrl: 'https://api.github.com',
    owner: 'myorg',
    repo: 'my-repo',
    description: 'A test provider',
    isSkillRepo: false,
    skillRepoBranch: null,
    skillRepoServiceUrl: null,
    skillRepoLastSyncAt: null,
    skillRepoLastSyncCommit: null,
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

  it('renders the provider label, apiBaseUrl, and description', () => {
    render(
      <table>
        <tbody>
          <GitHubProviderRow provider={mockProvider} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('My Provider')).toBeInTheDocument();
    expect(screen.getByText('https://api.github.com')).toBeInTheDocument();
    expect(screen.getByText('A test provider')).toBeInTheDocument();
  });

  it('opens the edit modal when Edit is clicked', () => {
    render(
      <table>
        <tbody>
          <GitHubProviderRow provider={mockProvider} />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText('Edit'));

    expect(openEditMock).toHaveBeenCalled();
  });

  it('opens the delete modal when Delete is clicked', () => {
    render(
      <table>
        <tbody>
          <GitHubProviderRow provider={mockProvider} />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText('Delete'));

    expect(openDeleteMock).toHaveBeenCalled();
  });

  it('shows a dash when description is empty', () => {
    render(
      <table>
        <tbody>
          <GitHubProviderRow provider={{ ...mockProvider, description: '' }} />
        </tbody>
      </table>,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('records an external navigation when the sync commit link is clicked', () => {
    render(
      <table>
        <tbody>
          <GitHubProviderRow
            provider={{
              ...mockProvider,
              isSkillRepo: true,
              skillRepoLastSyncCommit: 'abcdef1234567890',
            }}
          />
        </tbody>
      </table>,
    );

    fireEvent.click(screen.getByText('abcdef1'));

    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'Sync commit abcdef1',
      href: 'https://github.com/myorg/my-repo/commit/abcdef1234567890',
    });
  });
});

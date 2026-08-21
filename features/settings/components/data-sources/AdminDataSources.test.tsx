import { fireEvent, render, screen } from '@testing-library/react';
import { SessionProvider } from 'next-auth/react';
import AdminDataSources from './AdminDataSources';
import { UserRole } from '@/features/shared/types/user';

const mockDocuments = [
  {
    id: 'a',
    filename: 'alpha.pdf',
    collections: [{ id: 'col-alpha', name: 'Alpha', color: null, shared: false, ownerId: 'owner-1', ownerName: 'Alice' }],
  },
  {
    id: 'b',
    filename: 'beta.pdf',
    adminCreated: true,
    assignedGroupIds: ['group-1'],
    collections: [{ id: 'col-beta', name: 'Beta', color: null, shared: true, ownerId: 'current-user', ownerName: 'Me' }],
  },
  { id: 'c', filename: 'loose.pdf', collections: [] },
];

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      settings: { dataSources: { getAdminDocuments: { invalidate: jest.fn() } } },
      shared: { getDocuments: { invalidate: jest.fn() } },
    }),
  },
}));

jest.mock('@/features/settings/api/data-sources/demote-admin-document-collection', () => ({
  __esModule: true,
  default: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('@/features/settings/api/data-sources/get-admin-documents', () => ({
  __esModule: true,
  default: () => ({ data: { documents: mockDocuments }, isPending: false, error: null }),
}));

jest.mock('@/features/settings/api/user-groups/get-user-groups', () => ({
  __esModule: true,
  default: () => ({ data: { userGroups: [{ id: 'group-1', label: 'Engineering' }] } }),
}));

jest.mock('@/features/settings/api/user-groups/get-user-groups-as-lead', () => ({
  __esModule: true,
  default: () => ({ data: { userGroupsAsLead: [{ id: 'group-1', label: 'Engineering' }] } }),
}));

jest.mock('./modals/AddAdminDataSourceModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./modals/ShareFolderModal', () => ({
  __esModule: true,
  default: ({ opened, collectionId }: { opened: boolean; collectionId: string | null }) =>
    opened ? <div data-testid='share-modal'>{collectionId}</div> : null,
}));

jest.mock('./tables/AdminDataSourcesTable', () => ({
  __esModule: true,
  default: ({ documents }: { documents: Array<{ id: string; filename: string }> }) => (
    <div data-testid='mock-table'>
      {documents.map(d => (
        <div key={d.id} data-testid={`row-${d.filename}`}>
          {d.filename}
        </div>
      ))}
    </div>
  ),
}));

const renderWith = (role: UserRole) => {
  const session = { expires: '1', user: { role, id: 'current-user' } };
  return render(
    <SessionProvider session={session as never}>
      <AdminDataSources />
    </SessionProvider>
  );
};

describe('AdminDataSources (stacked collections + documents)', () => {
  it('renders the collections table with each derived collection', () => {
    renderWith(UserRole.User);
    expect(screen.getByTestId('collections-table')).toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-beta')).toBeInTheDocument();
  });

  it('shows every document until a collection is selected', () => {
    renderWith(UserRole.User);
    expect(screen.getByTestId('row-alpha.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('row-beta.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('row-loose.pdf')).toBeInTheDocument();
  });

  it('filters the document table to the selected collection and clears it again', () => {
    renderWith(UserRole.User);

    fireEvent.click(screen.getByTestId('collection-row-col-beta'));
    expect(screen.getByTestId('row-beta.pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('row-alpha.pdf')).not.toBeInTheDocument();
    expect(screen.queryByTestId('row-loose.pdf')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('clear-collection-filter'));
    expect(screen.getByTestId('row-alpha.pdf')).toBeInTheDocument();
    expect(screen.getByTestId('row-loose.pdf')).toBeInTheDocument();
  });

  it('opens the share modal with the chosen collection id from the per-row button', () => {
    renderWith(UserRole.User);
    // col-beta is owned by current-user and already shared -> Edit groups opens the share modal
    fireEvent.click(screen.getByTestId('edit-collection-groups-col-beta'));
    expect(screen.getByTestId('share-modal')).toHaveTextContent('col-beta');
  });

  it('collapses and re-expands the collections table', () => {
    renderWith(UserRole.User);
    expect(screen.getByTestId('collections-table')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('collections-collapse-toggle'));
    expect(screen.queryByTestId('collections-table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('collections-collapse-toggle'));
    expect(screen.getByTestId('collections-table')).toBeInTheDocument();
  });
});

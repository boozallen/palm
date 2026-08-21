import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CollectionsTable, { CollectionRow } from './CollectionsTable';

// Stub Select so the "Shared" filter is a deterministic native <select>.
jest.mock('@mantine/core', () => {
  const actual = jest.requireActual('@mantine/core');
  return {
    ...actual,
    Select: ({
      value,
      onChange,
      data,
      'data-testid': testId,
    }: {
      value: string | null;
      onChange: (v: string | null) => void;
      data: Array<{ value: string; label: string }>;
      'data-testid'?: string;
    }) => (
      <select
        data-testid={testId}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value=''>All</option>
        {data.map(d => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    ),
  };
});

const COLLECTIONS: CollectionRow[] = [
  { id: 'col-alpha', name: 'Alpha', color: null, sharedCount: 0, mixedGroups: false, sharedGroupIds: [], sharedGroupLabels: [], ownerId: 'owner-1', ownerName: 'Alice', count: 12 },
  { id: 'col-beta', name: 'Beta', color: null, sharedCount: 2, mixedGroups: false, sharedGroupIds: ['group-beta'], sharedGroupLabels: ['Beta Team'], ownerId: 'current-user', ownerName: 'Me', count: 2 },
  { id: 'col-atlas', name: 'Atlas', color: null, sharedCount: 0, mixedGroups: false, sharedGroupIds: [], sharedGroupLabels: [], ownerId: 'owner-2', ownerName: 'Aron', count: 7 },
];

const setup = (props: Partial<ComponentProps<typeof CollectionsTable>> = {}) => {
  const onSelect = jest.fn();
  const onShare = jest.fn();
  const onRemoveShare = jest.fn();
  render(
    <CollectionsTable
      collections={COLLECTIONS}
      selectedCollectionId={null}
      currentUserId='current-user'
      isAdmin={false}
      onSelect={onSelect}
      onShare={onShare}
      onRemoveShare={onRemoveShare}
      {...props}
    />
  );
  return { onSelect, onShare, onRemoveShare };
};

const rowOrder = () =>
  screen.getAllByTestId(/^collection-row-/).map(r => r.getAttribute('data-testid'));

describe('CollectionsTable', () => {
  it('renders every collection by default', () => {
    setup();
    expect(screen.getByTestId('collection-row-col-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-beta')).toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-atlas')).toBeInTheDocument();
  });

  it('filters by collection name', () => {
    setup();
    fireEvent.change(screen.getByTestId('collections-filter-search'), { target: { value: 'alp' } });
    expect(screen.getByTestId('collection-row-col-alpha')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-beta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-atlas')).not.toBeInTheDocument();
  });

  it('filters by owner name', () => {
    setup();
    fireEvent.change(screen.getByTestId('collections-filter-search'), { target: { value: 'aron' } });
    expect(screen.getByTestId('collection-row-col-atlas')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-beta')).not.toBeInTheDocument();
  });

  it('filters by shared status', () => {
    setup();
    fireEvent.change(screen.getByTestId('collections-filter-shared'), { target: { value: 'shared' } });
    expect(screen.getByTestId('collection-row-col-beta')).toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('collection-row-col-atlas')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('collections-filter-shared'), { target: { value: 'not-shared' } });
    expect(screen.queryByTestId('collection-row-col-beta')).not.toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('collection-row-col-atlas')).toBeInTheDocument();
  });

  it('sorts by document count (descending, then ascending)', () => {
    setup();
    // unsorted: preserves the order it was given (Alpha, Beta, Atlas)
    expect(rowOrder()).toEqual(['collection-row-col-alpha', 'collection-row-col-beta', 'collection-row-col-atlas']);

    fireEvent.click(screen.getByTestId('collections-sort-docs')); // desc: 12, 7, 2
    expect(rowOrder()).toEqual(['collection-row-col-alpha', 'collection-row-col-atlas', 'collection-row-col-beta']);

    fireEvent.click(screen.getByTestId('collections-sort-docs')); // asc: 2, 7, 12
    expect(rowOrder()).toEqual(['collection-row-col-beta', 'collection-row-col-atlas', 'collection-row-col-alpha']);
  });

  it('shows actions only on folders the viewer can share (owner)', () => {
    setup(); // isAdmin=false, currentUserId=current-user
    // col-beta is owned by current-user AND already shared -> edit + remove
    expect(screen.getByTestId('edit-collection-groups-col-beta')).toBeInTheDocument();
    expect(screen.getByTestId('remove-collection-share-col-beta')).toBeInTheDocument();
    // folders owned by others expose no actions
    expect(screen.queryByTestId('share-collection-col-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('edit-collection-groups-col-alpha')).not.toBeInTheDocument();
    expect(screen.queryByTestId('share-collection-col-atlas')).not.toBeInTheDocument();
  });

  it('shows Designate on unshared folders and Edit/Remove on shared folders for an admin', () => {
    setup({ isAdmin: true });
    // unshared -> designate (promote)
    expect(screen.getByTestId('share-collection-col-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('share-collection-col-atlas')).toBeInTheDocument();
    // shared -> edit groups + remove share status (no designate)
    expect(screen.getByTestId('edit-collection-groups-col-beta')).toBeInTheDocument();
    expect(screen.getByTestId('remove-collection-share-col-beta')).toBeInTheDocument();
    expect(screen.queryByTestId('share-collection-col-beta')).not.toBeInTheDocument();
  });

  it('calls onShare without selecting the row when Designate is clicked', () => {
    const { onSelect, onShare } = setup({ isAdmin: true });
    fireEvent.click(screen.getByTestId('share-collection-col-alpha')); // unshared
    expect(onShare).toHaveBeenCalledWith('col-alpha', 'Alpha');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onShare from Edit groups and onRemoveShare from Remove, without selecting the row', () => {
    const { onSelect, onShare, onRemoveShare } = setup();
    fireEvent.click(screen.getByTestId('edit-collection-groups-col-beta'));
    expect(onShare).toHaveBeenCalledWith('col-beta', 'Beta');

    fireEvent.click(screen.getByTestId('remove-collection-share-col-beta'));
    expect(onRemoveShare).toHaveBeenCalledWith('col-beta', 'Beta');

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('treats a partially-shared folder as mixed: share-remaining + remove actions and an N-of-M indicator', () => {
    const partial: CollectionRow[] = [
      { id: 'col-mix', name: 'Mixed', color: null, sharedCount: 1, mixedGroups: false, sharedGroupIds: ['group-x'], sharedGroupLabels: ['Team X'], ownerId: 'current-user', ownerName: 'Me', count: 3 },
    ];
    const { onShare, onRemoveShare } = setup({ collections: partial });

    // Shows it's partial, not fully shared.
    expect(screen.getByTestId('collection-partial-col-mix')).toHaveTextContent('1 of 3 shared');
    expect(screen.getByTestId('collection-group-badge-Team X')).toBeInTheDocument();

    // Both a promote (share remaining) and a demote (remove) are offered.
    fireEvent.click(screen.getByTestId('share-collection-col-mix'));
    expect(onShare).toHaveBeenCalledWith('col-mix', 'Mixed');
    fireEvent.click(screen.getByTestId('remove-collection-share-col-mix'));
    expect(onRemoveShare).toHaveBeenCalledWith('col-mix', 'Mixed');

    // No Edit-groups action in the partial state (that's the fully-shared affordance).
    expect(screen.queryByTestId('edit-collection-groups-col-mix')).not.toBeInTheDocument();
  });

  it('selects a collection when its row is clicked, and deselects on re-click', () => {
    const { onSelect } = setup({ selectedCollectionId: 'col-beta' });
    fireEvent.click(screen.getByTestId('collection-row-col-alpha'));
    expect(onSelect).toHaveBeenCalledWith('col-alpha');

    fireEvent.click(screen.getByTestId('collection-row-col-beta')); // already selected -> clear
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('shows the user groups a shared collection was shared with, and Unshared otherwise', () => {
    setup();
    expect(screen.getByTestId('collection-group-badge-Beta Team')).toBeInTheDocument();
    expect(screen.getByTestId('collection-unshared-col-alpha')).toBeInTheDocument();
    expect(screen.getByTestId('collection-unshared-col-atlas')).toBeInTheDocument();
  });

  it('flags a fully-shared folder whose documents have different groups as Mixed (union + marker)', () => {
    const heterogeneous: CollectionRow[] = [
      {
        id: 'col-het', name: 'Het', color: null, sharedCount: 2, mixedGroups: true,
        sharedGroupIds: ['group-a', 'group-b'], sharedGroupLabels: ['Alpha Team', 'Beta Team'],
        ownerId: 'current-user', ownerName: 'Me', count: 2,
      },
    ];
    setup({ collections: heterogeneous });

    // Union of groups is shown, plus a Mixed marker.
    expect(screen.getByTestId('collection-group-badge-Alpha Team')).toBeInTheDocument();
    expect(screen.getByTestId('collection-group-badge-Beta Team')).toBeInTheDocument();
    expect(screen.getByTestId('collection-mixed-col-het')).toHaveTextContent('Mixed');

    // Fully shared -> the Edit-groups affordance is still offered (with an overwrite warning in the modal).
    expect(screen.getByTestId('edit-collection-groups-col-het')).toBeInTheDocument();
  });

  it('shows an empty-state message when no collection matches', () => {
    setup();
    fireEvent.change(screen.getByTestId('collections-filter-search'), { target: { value: 'zzz-none' } });
    expect(screen.getByTestId('collections-empty')).toBeInTheDocument();
  });
});

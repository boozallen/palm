import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareFolderModal from './ShareFolderModal';

const mockPromote = jest.fn();
const mockInvalidate = jest.fn();
const mockShow = jest.fn();

jest.mock('@/features/settings/api/data-sources/promote-admin-document', () => ({
  __esModule: true,
  default: () => ({ mutateAsync: mockPromote, isPending: false }),
}));

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: () => ({
      settings: { dataSources: { getAdminDocuments: { invalidate: mockInvalidate } } },
      shared: { getDocuments: { invalidate: jest.fn() } },
    }),
  },
}));

jest.mock('@mantine/notifications', () => ({
  notifications: { show: (...args: unknown[]) => mockShow(...args) },
}));

// Stub MultiSelect so selecting a group is a single deterministic click.
jest.mock('@mantine/core', () => {
  const actual = jest.requireActual('@mantine/core');
  return {
    ...actual,
    MultiSelect: ({
      value,
      onChange,
      data,
      'data-testid': testId,
    }: {
      value: string[];
      onChange: (v: string[]) => void;
      data: Array<{ value: string; label: string }>;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} onClick={() => onChange([data[0]?.value])}>
        {`selected:${value.join(',')}`}
      </button>
    ),
  };
});

describe('ShareFolderModal', () => {
  const groups = [
    { id: 'group-1', label: 'Engineering' },
    { id: 'group-2', label: 'Product' },
  ];
  const baseProps = {
    opened: true,
    onClose: jest.fn(),
    collectionId: 'col-1',
    collectionName: 'Pursuit Docs',
    availableGroups: groups,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockPromote.mockResolvedValue(undefined);
  });

  it('renders the folder name in the title', () => {
    render(<ShareFolderModal {...baseProps} />);
    expect(screen.getByText('Share folder: Pursuit Docs')).toBeInTheDocument();
  });

  it('disables Share until a group is selected', () => {
    render(<ShareFolderModal {...baseProps} />);
    expect(screen.getByTestId('share-folder-confirm')).toBeDisabled();
  });

  it('promotes the collection to the selected groups and shows a success notification', async () => {
    render(<ShareFolderModal {...baseProps} />);

    fireEvent.click(screen.getByTestId('share-folder-groups')); // selects group-1 via stub
    fireEvent.click(screen.getByTestId('share-folder-confirm'));

    await waitFor(() =>
      expect(mockPromote).toHaveBeenCalledWith({ collectionId: 'col-1', userGroupIds: ['group-1'] })
    );
    expect(mockInvalidate).toHaveBeenCalled();
    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'Folder Shared' }))
    );
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it('does not promote when no collection is set', () => {
    render(<ShareFolderModal {...baseProps} collectionId={null} />);
    fireEvent.click(screen.getByTestId('share-folder-groups'));
    fireEvent.click(screen.getByTestId('share-folder-confirm'));
    expect(mockPromote).not.toHaveBeenCalled();
  });

  it('switches to edit mode and pre-fills the current groups when initialGroupIds is provided', async () => {
    render(<ShareFolderModal {...baseProps} initialGroupIds={['group-1']} />);

    // Edit-mode wording
    expect(screen.getByText('Edit groups: Pursuit Docs')).toBeInTheDocument();
    // Pre-filled selection (the stubbed MultiSelect renders the current value)
    expect(screen.getByTestId('share-folder-groups')).toHaveTextContent('selected:group-1');
    expect(screen.getByTestId('share-folder-confirm')).toHaveTextContent('Save');

    fireEvent.click(screen.getByTestId('share-folder-confirm'));
    await waitFor(() =>
      expect(mockPromote).toHaveBeenCalledWith({ collectionId: 'col-1', userGroupIds: ['group-1'] })
    );
    await waitFor(() =>
      expect(mockShow).toHaveBeenCalledWith(expect.objectContaining({ title: 'Groups Updated' }))
    );
  });

  it('shows the overwrite warning when the folder has mixed per-document groups', () => {
    render(<ShareFolderModal {...baseProps} initialGroupIds={['group-1', 'group-2']} mixedWarning />);
    expect(screen.getByTestId('share-folder-mixed-warning')).toBeInTheDocument();
  });

  it('does not show the overwrite warning when groups are uniform', () => {
    render(<ShareFolderModal {...baseProps} initialGroupIds={['group-1']} />);
    expect(screen.queryByTestId('share-folder-mixed-warning')).not.toBeInTheDocument();
  });
});

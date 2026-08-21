import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import AdminDataSourceRow from './AdminDataSourceRow';
import useDemoteAdminDocument from '@/features/settings/api/data-sources/demote-admin-document';
import useDeleteDocument from '@/features/shared/api/document-upload/delete-document';
import useAssignAdminDocumentGroups from '@/features/settings/api/data-sources/assign-groups';
import { trpc } from '@/libs';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/features/settings/api/data-sources/demote-admin-document');
jest.mock('@/features/shared/api/document-upload/delete-document');
jest.mock('@/features/settings/api/data-sources/assign-groups');
jest.mock('@mantine/notifications');
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(),
  },
}));

describe('AdminDataSourceRow', () => {
  const mockUtils = {
    settings: {
      dataSources: {
        getAdminDocuments: {
          invalidate: jest.fn(),
        },
      },
    },
    shared: {
      getDocuments: {
        invalidate: jest.fn(),
      },
    },
  };

  const mockDocument = {
    id: 'doc-123',
    userId: 'user-456',
    filename: 'test-document.pdf',
    createdAt: new Date('2024-01-01'),
    adminCreated: true,
    assignedGroupIds: ['group-1', 'group-2'],
    userName: 'John Doe',
    userEmail: 'john.doe@example.com',
    userGroupMemberships: [
      { id: 'group-1', label: 'Engineering' },
      { id: 'group-2', label: 'Product' },
    ],
    uploadStatus: DocumentUploadStatus.Completed,
  };

  const mockAvailableGroups = [
    { id: 'group-1', label: 'Engineering' },
    { id: 'group-2', label: 'Product' },
    { id: 'group-3', label: 'Design' },
  ];

  const mockDemoteAdminDocument = jest.fn();
  const mockDeleteDocument = jest.fn();
  const mockOnPromoteDocument = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (trpc.useUtils as jest.Mock).mockReturnValue(mockUtils);
    (useDemoteAdminDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDemoteAdminDocument,
      isPending: false,
    });
    (useDeleteDocument as jest.Mock).mockReturnValue({
      mutateAsync: mockDeleteDocument,
      isPending: false,
    });
    (useAssignAdminDocumentGroups as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });
  });

  const renderRow = (document: typeof mockDocument, currentUserId: string = 'user-789') => {
    return render(
      <table>
        <tbody>
          <AdminDataSourceRow
            document={document}
            availableGroups={mockAvailableGroups}
            currentUserId={currentUserId}
            onPromoteDocument={mockOnPromoteDocument}
          />
        </tbody>
      </table>
    );
  };

  it('renders document information correctly', () => {
    renderRow(mockDocument);

    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
    expect(screen.getByText('Engineering')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
  });

  it('shows assign groups and demote buttons for admin-created documents', () => {
    renderRow(mockDocument);

    expect(screen.getByLabelText('Assign groups for test-document.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove admin status from test-document.pdf')).toBeInTheDocument();
  });

  it('shows promote button for non-admin documents owned by current user', () => {
    const nonAdminDocument = {
      ...mockDocument,
      adminCreated: false,
      userId: 'current-user-id',
      assignedGroupIds: [],
    };

    renderRow(nonAdminDocument, 'current-user-id');

    expect(screen.getByLabelText('Promote test-document.pdf to admin data source')).toBeInTheDocument();
  });

  it('shows no action buttons for non-admin documents not owned by current user', () => {
    const nonAdminDocument = {
      ...mockDocument,
      adminCreated: false,
      userId: 'other-user-id',
      assignedGroupIds: [],
    };

    renderRow(nonAdminDocument, 'current-user-id');

    expect(screen.queryByLabelText(/Promote/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Assign groups/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Remove admin status/)).not.toBeInTheDocument();
  });

  it('opens demote modal when demote button is clicked', () => {
    renderRow(mockDocument);

    const demoteButton = screen.getByLabelText('Remove admin status from test-document.pdf');
    fireEvent.click(demoteButton);

    expect(screen.getByRole('heading', { name: 'Remove Group Resource Status' })).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to remove group resource status/)).toBeInTheDocument();
  });

  it('successfully demotes admin document', async () => {
    mockDemoteAdminDocument.mockResolvedValue({});

    renderRow(mockDocument);

    const demoteButton = screen.getByLabelText('Remove admin status from test-document.pdf');
    fireEvent.click(demoteButton);

    const confirmButton = screen.getByRole('button', { name: /Remove Group Resource Status/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDemoteAdminDocument).toHaveBeenCalledWith({ documentId: 'doc-123' });
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Admin Status Removed',
        message: '"test-document.pdf" is no longer an admin data source',
        icon: expect.anything(),
        variant: 'successful_operation',
        autoClose: 3000,
      });
      expect(mockUtils.settings.dataSources.getAdminDocuments.invalidate).toHaveBeenCalled();
      expect(mockUtils.shared.getDocuments.invalidate).toHaveBeenCalled();
    });
  });

  it('handles demote failure', async () => {
    const error = new Error('Failed to demote document');
    mockDemoteAdminDocument.mockRejectedValue(error);

    renderRow(mockDocument);

    const demoteButton = screen.getByLabelText('Remove admin status from test-document.pdf');
    fireEvent.click(demoteButton);

    const confirmButton = screen.getByRole('button', { name: /Remove Group Resource Status/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Demotion Failed',
        message: 'Failed to demote document',
        icon: expect.anything(),
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    });
  });

  it('opens delete modal when delete button is clicked', () => {
    renderRow(mockDocument);

    const deleteButton = screen.getByLabelText('Delete test-document.pdf');
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete Document')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete this document/)).toBeInTheDocument();
  });

  it('successfully deletes document', async () => {
    mockDeleteDocument.mockResolvedValue({});

    renderRow(mockDocument);

    const deleteButton = screen.getByLabelText('Delete test-document.pdf');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteDocument).toHaveBeenCalledWith({ documentId: 'doc-123' });
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Document Deleted',
        message: '"test-document.pdf" has been permanently deleted',
        icon: expect.anything(),
        variant: 'successful_operation',
        autoClose: 3000,
      });
      expect(mockUtils.settings.dataSources.getAdminDocuments.invalidate).toHaveBeenCalled();
      expect(mockUtils.shared.getDocuments.invalidate).toHaveBeenCalled();
    });
  });

  it('handles delete failure', async () => {
    const error = new Error('Failed to delete document');
    mockDeleteDocument.mockRejectedValue(error);

    renderRow(mockDocument);

    const deleteButton = screen.getByLabelText('Delete test-document.pdf');
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /Delete/ });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        title: 'Delete Failed',
        message: 'Failed to delete document',
        icon: expect.anything(),
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    });
  });

  it('calls onPromoteDocument when promote button is clicked', () => {
    const nonAdminDocument = {
      ...mockDocument,
      adminCreated: false,
      userId: 'current-user-id',
      assignedGroupIds: [],
    };

    renderRow(nonAdminDocument, 'current-user-id');

    const promoteButton = screen.getByLabelText('Promote test-document.pdf to admin data source');
    fireEvent.click(promoteButton);

    expect(mockOnPromoteDocument).toHaveBeenCalledWith('doc-123');
  });

  it('displays no badges when document has no assigned groups', () => {
    const documentWithNoGroups = {
      ...mockDocument,
      assignedGroupIds: [],
    };

    renderRow(documentWithNoGroups);

    expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
    expect(screen.queryByText('Product')).not.toBeInTheDocument();
  });

  it('renders upload status badge correctly', () => {
    renderRow(mockDocument);

    const uploadStatusCell = screen.getByTestId('document-upload-status');
    expect(uploadStatusCell).toBeInTheDocument();
    expect(screen.getByTestId('upload-status-completed')).toBeInTheDocument();
  });

  it('renders different upload statuses with correct colors', () => {
    const { rerender } = render(
      <table>
        <tbody>
          <AdminDataSourceRow
            document={{ ...mockDocument, uploadStatus: DocumentUploadStatus.Pending }}
            availableGroups={mockAvailableGroups}
            currentUserId='user-789'
            onPromoteDocument={mockOnPromoteDocument}
          />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('upload-status-pending')).toBeInTheDocument();

    rerender(
      <table>
        <tbody>
          <AdminDataSourceRow
            document={{ ...mockDocument, uploadStatus: DocumentUploadStatus.Failed }}
            availableGroups={mockAvailableGroups}
            currentUserId='user-789'
            onPromoteDocument={mockOnPromoteDocument}
          />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('upload-status-failed')).toBeInTheDocument();
  });
});

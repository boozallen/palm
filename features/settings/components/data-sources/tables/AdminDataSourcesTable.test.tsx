import { render, screen, fireEvent } from '@testing-library/react';
import AdminDataSourcesTable from './AdminDataSourcesTable';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('./AdminDataSourceRow', () => {
  return function MockAdminDataSourceRow({ document }: { document: { filename: string } }) {
    return <tr data-testid={`row-${document.filename}`}><td>{document.filename}</td></tr>;
  };
});

describe('AdminDataSourcesTable', () => {
  const mockAvailableGroups = [
    { id: 'group-1', label: 'Engineering' },
    { id: 'group-2', label: 'Product' },
  ];

  const mockOnPromoteDocument = jest.fn();

  const createMockDocuments = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `doc-${i}`,
      userId: `user-${i}`,
      filename: `document-${i}.pdf`,
      createdAt: new Date('2024-01-01'),
      adminCreated: true,
      assignedGroupIds: ['group-1'],
      userName: `User ${i}`,
      userEmail: `user${i}@example.com`,
      userGroupMemberships: [{ id: 'group-1', label: 'Engineering' }],
      uploadStatus: DocumentUploadStatus.Completed,
    }));
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders table with documents', () => {
    const documents = createMockDocuments(3);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('admin-data-sources-table')).toBeInTheDocument();
    expect(screen.getByTestId('header-filename')).toBeInTheDocument();
    expect(screen.getByTestId('header-owner')).toBeInTheDocument();
    expect(screen.getByTestId('header-auto-shared-with')).toBeInTheDocument();
    expect(screen.getByTestId('header-sharing')).toBeInTheDocument();
    expect(screen.getByTestId('header-upload-status')).toBeInTheDocument();
    expect(screen.getByTestId('header-graph-status')).toBeInTheDocument();
    expect(screen.getByTestId('header-created')).toBeInTheDocument();
    expect(screen.getByTestId('header-actions')).toBeInTheDocument();
  });

  it('renders info tooltip for Admin Data Source header', () => {
    const documents = createMockDocuments(1);

    const { container } = render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Check that the info icon SVG is present
    const infoIcon = container.querySelector('svg.tabler-icon-info-circle');
    expect(infoIcon).toBeInTheDocument();
  });

  it('does not show pagination when documents fit on one page', () => {
    const documents = createMockDocuments(5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.queryByTestId('admin-data-sources-pagination')).not.toBeInTheDocument();
  });

  it('shows pagination when documents exceed one page', () => {
    const documents = createMockDocuments(ITEMS_PER_PAGE + 5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('admin-data-sources-pagination')).toBeInTheDocument();
  });

  it('displays only first page of documents initially', () => {
    const documents = createMockDocuments(ITEMS_PER_PAGE + 5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // First page documents should be visible
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      expect(screen.getByTestId(`row-document-${i}.pdf`)).toBeInTheDocument();
    }

    // Documents beyond first page should not be visible
    expect(screen.queryByTestId(`row-document-${ITEMS_PER_PAGE}.pdf`)).not.toBeInTheDocument();
  });

  it('changes displayed documents when navigating to next page', () => {
    const documents = createMockDocuments(ITEMS_PER_PAGE + 5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    // First page documents should not be visible
    expect(screen.queryByTestId('row-document-0.pdf')).not.toBeInTheDocument();

    // Second page documents should be visible
    expect(screen.getByTestId(`row-document-${ITEMS_PER_PAGE}.pdf`)).toBeInTheDocument();
  });

  it('calculates correct number of pages', () => {
    const totalDocuments = ITEMS_PER_PAGE * 2 + 5;
    const documents = createMockDocuments(totalDocuments);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Should have 3 pages (ITEMS_PER_PAGE * 2 + 5 documents)
    const pagination = screen.getByTestId('admin-data-sources-pagination');
    expect(pagination).toBeInTheDocument();

    // Check that page 3 exists
    const page3Button = screen.getByRole('button', { name: '3' });
    expect(page3Button).toBeInTheDocument();
  });

  it('resets to last valid page when current page exceeds total pages', () => {
    const { rerender } = render(
      <AdminDataSourcesTable
        documents={createMockDocuments(ITEMS_PER_PAGE + 5)}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Navigate to page 2
    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    // Update with fewer documents (only 1 page worth)
    rerender(
      <AdminDataSourcesTable
        documents={createMockDocuments(5)}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Should show documents from page 1
    expect(screen.getByTestId('row-document-0.pdf')).toBeInTheDocument();
  });

  it('passes correct props to AdminDataSourceRow', () => {
    const documents = createMockDocuments(1);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='test-user-id'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('row-document-0.pdf')).toBeInTheDocument();
  });

  it('handles empty documents array', () => {
    render(
      <AdminDataSourcesTable
        documents={[]}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('admin-data-sources-table')).toBeInTheDocument();
    expect(screen.queryByTestId(/row-/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('admin-data-sources-pagination')).not.toBeInTheDocument();
  });

  it('handles pagination controls accessibility', () => {
    const documents = createMockDocuments(ITEMS_PER_PAGE + 5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByLabelText('Previous')).toBeInTheDocument();
    expect(screen.getByLabelText('Next')).toBeInTheDocument();
  });

  it('displays all documents on their respective pages', () => {
    const totalDocuments = ITEMS_PER_PAGE * 2;
    const documents = createMockDocuments(totalDocuments);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Check page 1
    for (let i = 0; i < ITEMS_PER_PAGE; i++) {
      expect(screen.getByTestId(`row-document-${i}.pdf`)).toBeInTheDocument();
    }

    // Navigate to page 2
    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    // Check page 2
    for (let i = ITEMS_PER_PAGE; i < totalDocuments; i++) {
      expect(screen.getByTestId(`row-document-${i}.pdf`)).toBeInTheDocument();
    }
  });

  it('filters documents by filename when searching', () => {
    const documents = [
      ...createMockDocuments(3),
      {
        id: 'doc-special',
        userId: 'user-special',
        filename: 'special-report.pdf',
        createdAt: new Date('2024-01-01'),
        adminCreated: true,
        assignedGroupIds: ['group-1'],
        userName: 'John Doe',
        userEmail: 'john@example.com',
        userGroupMemberships: [{ id: 'group-1', label: 'Engineering' }],
        uploadStatus: DocumentUploadStatus.Completed,
      },
    ];

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    const searchInput = screen.getByTestId('admin-data-sources-search');
    fireEvent.change(searchInput, { target: { value: 'special' } });

    expect(screen.getByTestId('row-special-report.pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('row-document-0.pdf')).not.toBeInTheDocument();
  });

  it('filters documents by username when searching', () => {
    const documents = [
      ...createMockDocuments(3),
      {
        id: 'doc-special',
        userId: 'user-special',
        filename: 'report.pdf',
        createdAt: new Date('2024-01-01'),
        adminCreated: true,
        assignedGroupIds: ['group-1'],
        userName: 'Alice Smith',
        userEmail: 'alice@example.com',
        userGroupMemberships: [{ id: 'group-1', label: 'Engineering' }],
        uploadStatus: DocumentUploadStatus.Completed,
      },
    ];

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    const searchInput = screen.getByTestId('admin-data-sources-search');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    expect(screen.getByTestId('row-report.pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('row-document-0.pdf')).not.toBeInTheDocument();
  });

  it('filters documents by email when searching', () => {
    const documents = [
      ...createMockDocuments(3),
      {
        id: 'doc-special',
        userId: 'user-special',
        filename: 'report.pdf',
        createdAt: new Date('2024-01-01'),
        adminCreated: true,
        assignedGroupIds: ['group-1'],
        userName: 'Bob Johnson',
        userEmail: 'bob.johnson@company.com',
        userGroupMemberships: [{ id: 'group-1', label: 'Engineering' }],
        uploadStatus: DocumentUploadStatus.Completed,
      },
    ];

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    const searchInput = screen.getByTestId('admin-data-sources-search');
    fireEvent.change(searchInput, { target: { value: 'company.com' } });

    expect(screen.getByTestId('row-report.pdf')).toBeInTheDocument();
    expect(screen.queryByTestId('row-document-0.pdf')).not.toBeInTheDocument();
  });

  it('resets to page 1 when searching', () => {
    const documents = createMockDocuments(ITEMS_PER_PAGE + 5);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    // Navigate to page 2
    const nextButton = screen.getByLabelText('Next');
    fireEvent.click(nextButton);

    // Verify we're on page 2
    expect(screen.queryByTestId('row-document-0.pdf')).not.toBeInTheDocument();

    // Search for something
    const searchInput = screen.getByTestId('admin-data-sources-search');
    fireEvent.change(searchInput, { target: { value: 'document-0' } });

    // Should show the first document (back to page 1)
    expect(screen.getByTestId('row-document-0.pdf')).toBeInTheDocument();
  });

  it('renders upload status filter', () => {
    const documents = createMockDocuments(3);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('admin-data-sources-upload-status-filter')).toBeInTheDocument();
  });

  it('renders graph status filter', () => {
    const documents = createMockDocuments(3);

    render(
      <AdminDataSourcesTable
        documents={documents}
        availableGroups={mockAvailableGroups}
        currentUserId='current-user'
        onPromoteDocument={mockOnPromoteDocument}
      />
    );

    expect(screen.getByTestId('admin-data-sources-graph-status-filter')).toBeInTheDocument();
  });
});

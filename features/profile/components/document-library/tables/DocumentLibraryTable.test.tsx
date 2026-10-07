import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import DocumentLibraryTable from './DocumentLibraryTable';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetActiveGraphBuilds } from '@/features/graph-database/api/get-active-graph-builds';
import { GraphBuildStatus } from '@/features/graph-database/types';
import { ActiveGraphBuildClient } from '@/features/graph-database/dal/getActiveGraphBuilds';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/shared/api/get-user-graph-database-access', () => ({
  useGetUserGraphDatabaseAccess: jest.fn().mockReturnValue({ data: { hasAccess: false } }),
}));
jest.mock('@/features/graph-database/api/get-active-graph-builds', () => ({
  useGetActiveGraphBuilds: jest.fn().mockReturnValue({ data: [] }),
}));
jest.mock('@/features/graph-database/api/get-graphed-documents', () => ({
  useGetGraphedDocuments: jest.fn().mockReturnValue({ data: { documentIds: [], ungraphableDocumentIds: [] } }),
}));
jest.mock('@/features/shared/api/document-collections/use-get-collections');
jest.mock('@/libs', () => ({
  trpc: { useUtils: jest.fn().mockReturnValue({ shared: { getDocuments: { invalidate: jest.fn() } } }) },
}));

jest.mock('./DocumentLibraryRow', () => {
  return function DocumentLibraryRow({ document, isGraphing }: { document: { id: string }; isGraphing: boolean }) {
    return (
      <tr data-testid={`doc-row-${document.id}`} data-graphing={String(isGraphing)}>
        <td>Document Library Row</td>
      </tr>
    );
  };
});

describe('DocumentLibraryTable', () => {
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';
  
  beforeEach(() => {
    jest.clearAllMocks();

    // clearAllMocks does not reset return values, so re-establish the default
    // (no active builds) before each test to prevent cross-test leakage.
    (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: [] });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: mockDocumentUploadProviderId,
      },
    });

    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: Array.from({ length: ITEMS_PER_PAGE + 1 }, (_, i) => ({
          id: `doc-${i}`,
          filename: `Document ${i}`,
          createdAt: new Date().toISOString(),
        })),
      },
      isLoading: false,
    });

    (useGetCollections as jest.Mock).mockReturnValue({
      data: [],
      isPending: false,
    });
  });

  it('renders table', () => {
    render(<DocumentLibraryTable />);

    const table = screen.getByTestId('user-document-library-table');
    expect(table).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<DocumentLibraryTable />);

    const headers = [
      screen.getByText('Name'),
      screen.getByText('Date Uploaded'),
      screen.getByText('Upload Status'),
      screen.getByText('Actions'),
    ];

    headers.forEach((header) => {
      expect(header).toBeInTheDocument();
    });
  });

  // Following tests will need to be updated when GET endpoint is implemented

  it('displays pagination if userDocuments.length > ITEMS_PER_PAGE', () => {
    render(<DocumentLibraryTable />);

    const pagination = screen.getByTestId('document-pagination');
    expect(pagination).toBeInTheDocument();

    const rows = screen.getAllByText('Document Library Row');
    expect(rows).toHaveLength(ITEMS_PER_PAGE);
  });

  it('updates document rows when changing pages', async () => {
    render(<DocumentLibraryTable />);

    const pagination = screen.getByTestId('document-pagination');
    const paginationButtons = Array.from(pagination.querySelectorAll('button'));
    const nextPageButton = paginationButtons[paginationButtons.length - 1];

    fireEvent.click(nextPageButton);
    await waitFor(() => {
      const rows = screen.getAllByText('Document Library Row');
      expect(rows).toHaveLength(1);
    });
  });

  it('only spins documents in newDocumentIds, not the full documentIds union', () => {
    const activeBuilds: ActiveGraphBuildClient[] = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-0', 'doc-1'],
        newDocumentIds: ['doc-1'],
        status: GraphBuildStatus.Building,
        createdAt: new Date().toISOString(),
      },
    ];
    (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: activeBuilds });

    render(<DocumentLibraryTable />);

    // doc-0 is in the union but not actively processing -> no spinner.
    expect(screen.getByTestId('doc-row-doc-0').getAttribute('data-graphing')).toBe('false');
    // doc-1 is the newly-added doc actually being processed -> spinner.
    expect(screen.getByTestId('doc-row-doc-1').getAttribute('data-graphing')).toBe('true');
  });

  it('falls back to documentIds for the spinner when newDocumentIds is absent', () => {
    const activeBuilds: ActiveGraphBuildClient[] = [
      {
        graphId: 'graph-1',
        documentIds: ['doc-0', 'doc-1'],
        status: GraphBuildStatus.Building,
        createdAt: new Date().toISOString(),
      },
    ];
    (useGetActiveGraphBuilds as jest.Mock).mockReturnValue({ data: activeBuilds });

    render(<DocumentLibraryTable />);

    // Without newDocumentIds the whole union spins (pre-fix behavior, degrade-safe).
    expect(screen.getByTestId('doc-row-doc-0').getAttribute('data-graphing')).toBe('true');
    expect(screen.getByTestId('doc-row-doc-1').getAttribute('data-graphing')).toBe('true');
  });

});

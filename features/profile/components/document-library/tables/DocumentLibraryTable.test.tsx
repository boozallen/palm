import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import DocumentLibraryTable from './DocumentLibraryTable';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./DocumentLibraryRow', () => {
  return function DocumentLibraryRow() {
    return <tr><td>Document Library Row</td></tr>;
  };
});

describe('DocumentLibraryTable', () => {
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';
  
  beforeEach(() => {
    jest.clearAllMocks();

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

});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ITEMS_PER_PAGE } from '@/features/shared/utils';
import UserDocumentLibraryTable from './UserDocumentLibraryTable';

jest.mock('./UserDocumentLibraryRow', () => {
  return function UserDocumentLibraryRow() {
    return <tr>User Document Library Row</tr>;
  };
});

describe('UserDocumentLibraryTable', () => {
  it('renders table', () => {
    render(<UserDocumentLibraryTable />);

    const table = screen.getByTestId('user-document-library-table');
    expect(table).toBeInTheDocument();
  });

  it('renders table headers', () => {
    render(<UserDocumentLibraryTable />);

    const headers = [
      screen.getByText('Name'),
      screen.getByText('Date Uploaded'),
      screen.getByText('Actions'),
    ];

    headers.forEach((header) => {
      expect(header).toBeInTheDocument();
    });
  });

  // Following tests will need to be updated when GET endpoint is implemented

  it('displays pagination if userDocuments.length > ITEMS_PER_PAGE', () => {
    render(<UserDocumentLibraryTable />);

    const pagination = screen.getByTestId('document-pagination');
    expect(pagination).toBeInTheDocument();

    const rows = screen.getAllByText('User Document Library Row');
    expect(rows).toHaveLength(ITEMS_PER_PAGE);
  });

  it('updates document rows when changing pages', async () => {
    render(<UserDocumentLibraryTable />);

    const pagination = screen.getByTestId('document-pagination');
    const paginationButtons = Array.from(pagination.querySelectorAll('button'));
    const nextPageButton = paginationButtons[paginationButtons.length - 1];

    fireEvent.click(nextPageButton);
    await waitFor(() => {
      const rows = screen.getAllByText('User Document Library Row');
      expect(rows).toHaveLength(1);
    });
  });

});

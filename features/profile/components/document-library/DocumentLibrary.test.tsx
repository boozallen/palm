import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import DocumentLibrary from './DocumentLibrary';

jest.mock('@mantine/hooks');

jest.mock('./tables/UserDocumentLibraryTable', () => {
  return function UserDocumentLibraryTable() {
    return <div>User Document Library Table</div>;
  };
});

describe('DocumentLibrary', () => {
  const openModal = jest.fn();
  const closeModal = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValue([
      false,
      { open: openModal, close: closeModal },
    ]);
  });

  it('renders title and action icon', () => {
    render(<DocumentLibrary />);

    const title = screen.getByText('My Uploaded Documents');
    const actionIcon = screen.getByTestId('add-document-button');

    expect(title).toBeInTheDocument();
    expect(actionIcon).toBeInTheDocument();
  });

  it('opens the modal when the action icon is clicked', () => {
    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    actionIcon.click();

    expect(openModal).toHaveBeenCalled();
  });

  it('renders table', () => {
    render(<DocumentLibrary />);

    const table = screen.getByText('User Document Library Table');

    expect(table).toBeInTheDocument();
  });
});

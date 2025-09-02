import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import DocumentLibrary from './DocumentLibrary';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';

jest.mock('@mantine/hooks');
jest.mock('@/features/shared/api/document-upload/get-document-upload-requirements', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./tables/DocumentLibraryTable', () => {
  return function DocumentLibraryTable() {
    return <div>Document Library Table</div>;
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

    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [{ name: 'Redis Instance', available: true }],
      },
      isPending: false,
    });
  });

  it('renders title, action icon, and document library table', () => {
    render(<DocumentLibrary />);

    const title = screen.getByText('My Uploaded Documents');
    const actionIcon = screen.getByTestId('add-document-button');

    expect(title).toBeInTheDocument();
    expect(actionIcon).toBeInTheDocument();
    expect(screen.queryByText('Document Library Table')).toBeInTheDocument();
  });

  it('opens the modal when the action icon is clicked', () => {
    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    actionIcon.click();

    expect(openModal).toHaveBeenCalled();
  });

  it('renders table', () => {
    render(<DocumentLibrary />);

    const table = screen.getByText('Document Library Table');

    expect(table).toBeInTheDocument();
  });

  it('disables add document button when document upload is not configured', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: false,
        requirements: [{ name: 'Redis Instance', available: false }],
      },
      isPending: false,
    });

    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    expect(actionIcon).toBeDisabled();
  });

  it('enables add document button when document upload is configured', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [{ name: 'Redis Instance', available: true }],
      },
      isPending: false,
    });

    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    expect(actionIcon).not.toBeDisabled();
  });

  it('disables add document button when requirements are loading', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<DocumentLibrary />);

    const actionIcon = screen.getByTestId('add-document-button');
    expect(actionIcon).toBeDisabled();
  });
});

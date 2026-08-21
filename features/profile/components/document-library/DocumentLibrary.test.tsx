import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';

import DocumentLibrary from './DocumentLibrary';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetCollections from '@/features/shared/api/document-collections/use-get-collections';
import useCreateCollection from '@/features/shared/api/document-collections/use-create-collection';
import useUpdateCollection from '@/features/shared/api/document-collections/use-update-collection';
import useDeleteCollection from '@/features/shared/api/document-collections/use-delete-collection';

jest.mock('@mantine/hooks');
jest.mock('@/features/shared/api/document-upload/get-document-upload-requirements');
jest.mock('@/features/shared/api/document-upload/get-documents');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/document-collections/use-get-collections');
jest.mock('@/features/shared/api/document-collections/use-create-collection');
jest.mock('@/features/shared/api/document-collections/use-update-collection');
jest.mock('@/features/shared/api/document-collections/use-delete-collection');

jest.mock('./tables/DocumentLibraryTable', () => {
  return function DocumentLibraryTable() {
    return <div>Document Library Table</div>;
  };
});

jest.mock('@/features/shared/components/modals/AddSourcesModal', () => {
  return function AddSourcesModal() {
    return <div>Add Sources Modal</div>;
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

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: 'test-provider-id',
      },
      isPending: false,
    });

    (useGetDocuments as jest.Mock).mockReturnValue({
      data: {
        documents: [],
      },
      isPending: false,
    });

    (useGetCollections as jest.Mock).mockReturnValue({
      data: {
        collections: [],
      },
      isPending: false,
    });

    (useCreateCollection as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useUpdateCollection as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    });

    (useDeleteCollection as jest.Mock).mockReturnValue({
      mutateAsync: jest.fn(),
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

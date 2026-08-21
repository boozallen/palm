import { render, screen } from '@testing-library/react';
import { useDisclosure } from '@mantine/hooks';
import { useSession } from 'next-auth/react';

import DocumentLibraryRow from './DocumentLibraryRow';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@mantine/hooks');
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));
jest.mock('@/libs', () => ({
  trpc: { useUtils: jest.fn().mockReturnValue({ shared: { getDocuments: { invalidate: jest.fn() } } }) },
}));
jest.mock('@/features/graph-database/api/build-graph', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ mutate: jest.fn(), isPending: false }),
}));

jest.mock('@/features/profile/components/document-library/modals/DeletePersonalDocumentModal', () => {
  return function MockDeletePersonalDocumentModal() {
    return <tr><td>Mock Delete Personal Document Modal</td></tr>;
  };
});

jest.mock('@/features/shared/components/document-library/modals/ManageDocumentCollectionsModal', () => {
  return function MockManageDocumentCollectionsModal() {
    return null;
  };
});

jest.mock('@/features/shared/components/document-library/components/CollectionBadges', () => {
  return function MockCollectionBadges() {
    return null;
  };
});

describe('DocumentLibraryRow', () => {
  const mockDocument = {
    id: 'f66b2688-a077-4b01-be8e-3cedbc879906',
    userId: '123456-abcdef-123456-abcdef',
    filename: 'software-setup-steps.txt',
    uploadStatus: DocumentUploadStatus.Pending,
    createdAt: new Date('2024-08-24T12:42:53.382'),
    adminCreated: false,
  };

  const openMock = jest.fn();

  const container = document.body
    .appendChild(document.createElement('table'))
    .appendChild(document.createElement('tbody'));

  beforeEach(() => {
    jest.clearAllMocks();

    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: '123456-abcdef-123456-abcdef' } },
    });

    (useDisclosure as jest.Mock).mockReturnValue([
      false, { open: openMock, close: jest.fn() },
    ]);
  });

  it('renders filename, formatted date, upload status, and delete icon', () => {
    render(<DocumentLibraryRow document={mockDocument} hasGraphAccess={false} isGraphed={false} isGraphing={false} />, { container });

    expect(screen.getByText(mockDocument.filename)).toBeInTheDocument();
    expect(screen.getByText('8/24/2024, 12:42 PM')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByLabelText(`Delete document ${mockDocument.id}`)).toBeInTheDocument();
  });

  it('opens modal when delete icon is clicked', () => {
    render(<DocumentLibraryRow document={mockDocument} hasGraphAccess={false} isGraphed={false} isGraphing={false} />, { container });

    screen.getByLabelText(`Delete document ${mockDocument.id}`).click();
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('renders DeletePersonalDocumentModal', () => {
    render(<DocumentLibraryRow document={mockDocument} hasGraphAccess={false} isGraphed={false} isGraphing={false} />, { container });

    expect(screen.getByText('Mock Delete Personal Document Modal')).toBeInTheDocument();
  });
});

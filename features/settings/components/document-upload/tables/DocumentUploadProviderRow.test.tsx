import { render, screen } from '@testing-library/react';

import DocumentUploadProviderRow from './DocumentUploadProviderRow';
import { documentUploadProviderLabels, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';
import { useDisclosure } from '@mantine/hooks';
import useGetDocumentUploadRequirements from '@/features/settings/api/document-upload/get-document-upload-requirements';
import { RequirementNames } from '@/features/settings/types/system-requirements';

jest.mock('@mantine/hooks');
jest.mock('@/features/settings/components/document-upload/modals/DeleteDocumentUploadProviderModal', () => {
  return jest.fn(() => <tr><td>Delete Document Upload Provider Modal</td></tr>);
});
jest.mock('@/features/settings/api/document-upload/get-document-upload-requirements');

describe('DocumentUploadProviderRow', () => {
  const mockDocumentProvider = {
    id: '1',
    label: 'My Provider',
    providerType: DocumentUploadProviderType.AWS,
    sourceUri: 's3://my-document-source',
  };

  let opened = false;
  const open = jest.fn(() => opened = true);
  const close = jest.fn(() => opened = false);

  beforeEach(() => {
    opened = false;

    (useDisclosure as jest.Mock).mockReturnValueOnce([
      opened, { open, close },
    ]);

    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [{ name: RequirementNames.OPENAI_MODEL, available: true }],
      },
      isPending: false,
    });
  });

  it('renders the provider data', () => {
    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );
    expect(screen.getByText('My Provider')).toBeInTheDocument();
    expect(screen.getByText('s3://my-document-source')).toBeInTheDocument();
    expect(screen.getByText(documentUploadProviderLabels[DocumentUploadProviderType.AWS])).toBeInTheDocument();
  });

  it('renders action icon', () => {
    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.getByLabelText('Delete provider My Provider')).toBeInTheDocument();
  });

  it('opens the modal when the action icon is clicked', () => {
    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    const deleteIcon = screen.getByLabelText('Delete provider My Provider');
    deleteIcon.click();

    expect(open).toHaveBeenCalled();
    expect(opened).toBe(true);
  });
});

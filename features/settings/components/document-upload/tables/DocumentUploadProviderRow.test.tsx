import { render, screen } from '@testing-library/react';

import DocumentUploadProviderRow from './DocumentUploadProviderRow';
import { documentUploadProviderLabels, DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';
import { useDisclosure } from '@mantine/hooks';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import { RequirementNames } from '@/features/settings/types/system-requirements';

jest.mock('@mantine/hooks');
jest.mock('@/features/settings/components/document-upload/modals/DeleteDocumentUploadProviderModal', () => {
  return jest.fn(() => <tr><td>Delete Document Upload Provider Modal</td></tr>);
});
jest.mock('@/features/shared/components/Loading', () => {
  return jest.fn(() => <div>Loading...</div>);
});
jest.mock('@/features/shared/api/document-upload/get-document-upload-requirements', () => ({
  __esModule: true,
  default: jest.fn(),
}));

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

    (useDisclosure as jest.Mock).mockReturnValue([
      opened, { open, close },
    ]);

    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [{ name: RequirementNames.BEDROCK_AI_PROVIDER, available: true }],
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

  it('shows Bedrock AI Provider status when requirements are available without info icon', () => {
    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.getByText(RequirementNames.BEDROCK_AI_PROVIDER)).toBeInTheDocument();
    const infoIcon = document.querySelector('svg.tabler-icon-info-circle');
    expect(infoIcon).not.toBeInTheDocument();
  });

  it('shows Bedrock AI Provider status when requirements are not available with info icon', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: false,
        requirements: [{ name: RequirementNames.BEDROCK_AI_PROVIDER, available: false }],
      },
      isPending: false,
    });

    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.getByText(RequirementNames.BEDROCK_AI_PROVIDER)).toBeInTheDocument();
    const infoIcon = document.querySelector('svg.tabler-icon-info-circle');
    expect(infoIcon).toBeInTheDocument();
  });

  it('shows Loading component when requirements are loading', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
    });

    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows nothing when requirements data is null and not loading', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
    });

    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.queryByText(RequirementNames.BEDROCK_AI_PROVIDER)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('shows nothing when requirements array is empty', () => {
    (useGetDocumentUploadRequirements as jest.Mock).mockReturnValue({
      data: {
        configured: true,
        requirements: [],
      },
      isPending: false,
    });

    render(
      <table>
        <tbody>
          <DocumentUploadProviderRow provider={mockDocumentProvider} />
        </tbody>
      </table>
    );

    expect(screen.queryByText(RequirementNames.BEDROCK_AI_PROVIDER)).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});

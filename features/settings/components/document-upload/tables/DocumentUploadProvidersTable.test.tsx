import { render, screen } from '@testing-library/react';

import DocumentUploadProvidersTable from './DocumentUploadProvidersTable';
import useGetDocumentUploadProviders from '@/features/settings/api/document-upload/get-document-upload-providers';
import { DocumentUploadProviderType, SanitizedDocumentUploadProvider } from '@/features/shared/types';

jest.mock('@/features/settings/api/document-upload/get-document-upload-providers');
jest.mock('./DocumentUploadProviderRow', () => {
  return jest.fn(() => <tr><td>Document Upload Provider Row</td></tr>);
});

const providers: SanitizedDocumentUploadProvider[] = [
  {
    id: '1',
    label: 'Provider 1',
    providerType: DocumentUploadProviderType.AWS,
    sourceUri: 's3://provider-1-source',
  },
  {
    id: '2',
    label: 'Provider 2',
    providerType: DocumentUploadProviderType.AWS,
    sourceUri: 's3://provider-2-source',
  },
];

const mockGetDocumentUploadProviders = (useGetDocumentUploadProviders as jest.Mock);

describe('DocumentUploadProvidersTable', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    mockGetDocumentUploadProviders.mockReturnValue({
      data: { providers },
      isPending: false,
    });
  });

  it('renders table headers', () => {
    render(<DocumentUploadProvidersTable />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('renders correct number of rows', () => {
    render(<DocumentUploadProvidersTable />);

    const rows = screen.getAllByText('Document Upload Provider Row');
    expect(rows).toHaveLength(providers.length);
  });

  it('renders message if no providers are configured', () => {
    mockGetDocumentUploadProviders.mockReturnValue({
      data: { providers: [] },
      isPending: false,
    });

    render(<DocumentUploadProvidersTable />);

    const message = screen.getByText(/no providers/i);

    expect(message).toBeInTheDocument();
  });

  it('renders error message if there is an error', () => {
    mockGetDocumentUploadProviders.mockReturnValue({
      data: null,
      isPending: false,
      error: new Error('There was an error'),
    });

    render(<DocumentUploadProvidersTable />);

    const message = screen.getByText(/an error/i);

    expect(message).toBeInTheDocument();
  });

  it('renders loading text if api is loading', () => {
    mockGetDocumentUploadProviders.mockReturnValue({
      data: null,
      isPending: true,
    });

    render(<DocumentUploadProvidersTable />);

    const message = screen.getByText(/loading/i);

    expect(message).toBeInTheDocument();
  });
});

import { renderWrapper } from '@/test/test-utils';

import DocumentLibraryDocumentUploadProviderSelectionTable from './DocumentLibraryDocumentUploadProviderSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

jest.mock('@/features/settings/components/system-configurations/tables/DocumentLibraryDocumentUploadProviderConfigRow', () => {
  return function MockDocumentLibraryDocumentUploadProviderConfigRow() {
    return (
      <tr data-testid='document-library-document-upload-provider-config-row'>
        <td>
        </td>
      </tr>
    );
  };
});

describe('DocumentLibraryDocumentUploadProviderSelectionTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryDocumentUploadProviderId: '2b0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
      },
    });
  });

  it('should render table header', () => {
    const { queryByText } = renderWrapper(<DocumentLibraryDocumentUploadProviderSelectionTable />);
    expect(queryByText('Document Library')).toBeInTheDocument();
  });

  it('displays DocumentLibraryDocumentUploadProviderConfigRow', () => {
    const { getByTestId } = renderWrapper(
      <DocumentLibraryDocumentUploadProviderSelectionTable />
    );

    expect(getByTestId('document-library-document-upload-provider-config-row')).toBeInTheDocument();
  });

  it('should display loading component when data is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { queryByText } = renderWrapper(<DocumentLibraryDocumentUploadProviderSelectionTable />);
    expect(queryByText('Loading...')).toBeInTheDocument();
  });

  it('should display error message when there is an error', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Error fetching system config' },
    });

    const { queryByText } = renderWrapper(<DocumentLibraryDocumentUploadProviderSelectionTable />);
    expect(queryByText('Error fetching system config')).toBeInTheDocument();
  });
});

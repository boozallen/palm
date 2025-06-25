import { render } from '@testing-library/react';
import DocumentLibraryKbProviderSelectionTable from './DocumentLibraryKbProviderSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';

jest.mock('@/features/shared/api/get-feature-flag');
jest.mock('@/features/shared/api/get-system-config');

jest.mock('@/features/settings/components/system-configurations/tables/DocumentLibraryKbProviderConfigRow', () => {
  return function MockDocumentLibraryKbProviderConfigRow() {
    return (
      <tr data-testid='document-library-kb-provider-config-row'>
        <td>
        </td>
      </tr>
    );
  };
});

describe('DocumentLibraryKbProviderSelectionTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetFeatureFlag as jest.Mock).mockImplementation(({ feature }) => {
      if (feature === features.DOCUMENT_LIBRARY) {
        return {
          data: {
            isFeatureOn: true,
          },
        };
      }
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        documentLibraryKbProviderId: '2b0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
      },
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<DocumentLibraryKbProviderSelectionTable />);
    expect(queryByText('Personal Document Library')).toBeInTheDocument();
  });

  it('displays DocumentLibraryKbProviderConfigRow', () => {
    const { getByTestId } = render(
      <DocumentLibraryKbProviderSelectionTable />
    );

    expect(getByTestId('document-library-kb-provider-config-row')).toBeInTheDocument();
  });

  it('should display loading component when data is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { queryByText } = render(<DocumentLibraryKbProviderSelectionTable />);
    expect(queryByText('Loading...')).toBeInTheDocument();
  });

  it('should display error message when there is an error', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Error fetching system config' },
    });

    const { queryByText } = render(<DocumentLibraryKbProviderSelectionTable />);
    expect(queryByText('Error fetching system config')).toBeInTheDocument();
  });

  it('does not render component if FF is off', () => {
    (useGetFeatureFlag as jest.Mock).mockImplementation(({ feature }) => {
      if (feature === features.DOCUMENT_LIBRARY) {
        return {
          data: { isFeatureOn: false },
          isPending: false,
          error: null,
        };
      }
    });

    const { container } = render(<DocumentLibraryKbProviderSelectionTable />);
    expect(container).toBeEmptyDOMElement();
  });
});

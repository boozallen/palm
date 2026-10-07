import { renderWrapper } from '@/test/test-utils';

import FastAiProviderModelSelectionTable from './FastAiProviderModelSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');

jest.mock('@/features/settings/components/system-configurations/tables/FastAiProviderModelConfigRow', () => {
  return function MockFastAiProviderModelConfigRow() {
    return (
      <tr data-testid='fast-ai-provider-model-config-row'>
        <td>
        </td>
        <td></td>
      </tr>
    );
  };
});

describe('FastAiProviderModelSelectionTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        fastAiProviderModelId: '2b0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
      },
    });
  });

  it('renders the table header', () => {
    const { queryByText } = renderWrapper(<FastAiProviderModelSelectionTable />);
    expect(queryByText('Fast AI Model')).toBeInTheDocument();
  });

  it('renders the config row', () => {
    const { getByTestId } = renderWrapper(<FastAiProviderModelSelectionTable />);
    expect(getByTestId('fast-ai-provider-model-config-row')).toBeInTheDocument();
  });

  it('displays loading when data is pending', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    const { queryByText } = renderWrapper(<FastAiProviderModelSelectionTable />);
    expect(queryByText('Loading...')).toBeInTheDocument();
  });

  it('displays error message on fetch failure', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Error fetching system config' },
    });

    const { queryByText } = renderWrapper(<FastAiProviderModelSelectionTable />);
    expect(queryByText('Error fetching system config')).toBeInTheDocument();
  });
});

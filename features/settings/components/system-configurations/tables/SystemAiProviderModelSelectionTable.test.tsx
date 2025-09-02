import { render } from '@testing-library/react';
import SystemAiProviderModelSelectionTable from './SystemAiProviderModelSelectionTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('./SystemAiProviderModelConfigRow', () => {
  return function SystemAiProviderModelConfigRow() {
    return <tr data-testid='system-ai-provider-model-config-row' />;
  };
});

describe('SystemAiProviderModelSelectionTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        systemAiProviderModelId: '1e0ef4b1-a1c7-42a0-b1fc-ad0d1b9e67dd',
      },
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<SystemAiProviderModelSelectionTable />);
    expect(queryByText('System AI Provider Model')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<SystemAiProviderModelSelectionTable />);
    expect(queryByTestId('system-ai-provider-model-config-row')).toBeInTheDocument();
  });
});

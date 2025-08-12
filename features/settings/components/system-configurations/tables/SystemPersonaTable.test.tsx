import { render } from '@testing-library/react';
import SystemPersonaTable from './SystemPersonaTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';

jest.mock('@/features/settings/api/update-system-config');
jest.mock('@/features/shared/api/get-system-config');

describe('SystemPersonaTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        systemMessage: 'System Message',
      },
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<SystemPersonaTable />);
    expect(queryByText('System Persona')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<SystemPersonaTable />);
    expect(queryByTestId('system-message-config-row')).toBeInTheDocument();
  });
});

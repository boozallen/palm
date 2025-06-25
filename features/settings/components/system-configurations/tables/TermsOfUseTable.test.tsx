import { render } from '@testing-library/react';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import TermsOfUseTable from '@/features/settings/components/system-configurations/tables/TermsOfUseTable';

jest.mock('@/features/settings/api/update-system-config');
jest.mock('@/features/shared/api/get-system-config');

describe('TermsOfUseTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        systemMessage: 'System Message',
        termsOfUseHeader: 'Header',
        termsOfUseBody: 'Body',
        termsOfUseCheckboxLabel: 'Checkbox label',
      },
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<TermsOfUseTable />);
    expect(queryByText('Terms of Use Acknowledgement')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<TermsOfUseTable />);
    expect(queryByTestId('terms-of-use-config-row')).toBeInTheDocument();
  });
});

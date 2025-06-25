import { render } from '@testing-library/react';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import LegalPolicyTable from '@/features/settings/components/system-configurations/tables/LegalPolicyTable';

jest.mock('@/features/settings/api/update-system-config');
jest.mock('@/features/shared/api/get-system-config');

describe('LegalPolicyTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: {
        systemMessage: 'System Message',
        legalPolicyHeader: 'Header',
        legalPolicyBody: 'Body',
      },
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
  });

  it('should render table header', () => {
    const { queryByText } = render(<LegalPolicyTable />);
    expect(queryByText('Legal Policy')).toBeInTheDocument();
  });

  it('should render table body', () => {
    const { queryByTestId } = render(<LegalPolicyTable />);
    expect(queryByTestId('legal-policy-config-row')).toBeInTheDocument();
  });
});

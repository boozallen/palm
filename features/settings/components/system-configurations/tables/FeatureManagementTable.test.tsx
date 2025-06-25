import { render, screen } from '@testing-library/react';
import FeatureManagementTable from './FeatureManagementTable';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { SystemConfigFields } from '@/features/shared/types/system';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-feature-flag');
jest.mock(
  '@/features/settings/components/system-configurations/tables/FeatureManagementConfigRow',
  () => {
    return function MockFeatureManagementConfigRow({
      field,
      label,
      checked,
    }: {
      field: SystemConfigFields;
      label: string;
      checked: boolean;
    }) {
      return (
        <tr data-testid={`feature-management-config-row-${field}`}>
          <td>{label}</td>
          <td>{checked}</td>
        </tr>
      );
    };
  }
);

describe('FeatureManagementTable Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockSystemConfig = Object.fromEntries(
      Object.entries(SystemConfigFields)
        .filter(([key]) => key.startsWith('FeatureManagement'))
        .map(([_, value]) => [value, true])
    );

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: mockSystemConfig,
      isPending: false,
    });
  });

  it('should render table headers', () => {
    render(<FeatureManagementTable />);
    expect(screen.getByText('Feature Management')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
  });

  it('should render FeatureManagementConfigRow for each feature', () => {
    render(<FeatureManagementTable />);

    Object.entries(SystemConfigFields)
      .filter(([key]) => key.startsWith('FeatureManagement'))
      .forEach(([_, value]) => {
        expect(
          screen.getByTestId(`feature-management-config-row-${value}`)
        ).toBeInTheDocument();
      });
  });
});

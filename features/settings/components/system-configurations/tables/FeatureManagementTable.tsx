import { Table } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import {
  SystemConfigFields,
  SystemConfigLabels,
} from '@/features/shared/types/system';
import FeatureManagementConfigRow from '@/features/settings/components/system-configurations/tables/FeatureManagementConfigRow';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

export default function FeatureManagementTable() {
  const { data: systemConfig, isPending: systemConfigPending } = useGetSystemConfig();

  if (systemConfigPending) {
    return <Loading />;
  }

  // Filters SystemConfigFields for FeatureManagement entries, mapping each to an object with
  // field, label and checked properties
  const featureManagementFields = Object.entries(SystemConfigFields)
    .filter(([key]) => key.startsWith('FeatureManagement'))
    .map(([_, value]) => ({
      field: value,
      label: SystemConfigLabels[value],
      checked: !!(systemConfig?.[value] ?? true),
    }));

  return (
    <Table data-testid='feature-management-table'>
      <thead>
        <tr>
          <th>Feature Management</th>
          <th>Enabled</th>
        </tr>
      </thead>
      <tbody>
        {featureManagementFields.map((field) => (
          <FeatureManagementConfigRow
            key={field.field}
            field={field.field}
            label={field.label}
            checked={field.checked}
          />
        ))}
      </tbody>
    </Table>
  );
}

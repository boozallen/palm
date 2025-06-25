import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import DefaultUserGroupConfigRow from './DefaultUserGroupConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function DefaultUserGroupSelectionTable() {
  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='default-user-group-selection-table'>
      <thead >
        <tr>
          <th colSpan={2}>Default User Group</th>
        </tr>
      </thead>
      <tbody>
        <DefaultUserGroupConfigRow defaultUserGroupId={systemConfig.defaultUserGroupId} />
      </tbody>
    </Table>
  );
}

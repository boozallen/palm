import { Table, Text } from '@mantine/core';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import JoinUserGroupDialogConfigRow from '@/features/settings/components/system-configurations/tables/JoinUserGroupDialogConfigRow';
import Loading from '@/features/shared/components/Loading';

export default function JoinUserGroupDialogTable() {
  const { data: systemConfig, isPending: systemConfigIsPending, error: systemConfigError } = useGetSystemConfig();

  if (systemConfigIsPending) {
    return <Loading />;
  }

  if (systemConfigError) {
    return <Text>{systemConfigError.message}</Text>;
  }

  return (
    <Table data-testid='join-user-group-dialog-table'>
      <thead>
        <tr>
          <th colSpan={2}>Join User Group Dialog</th>
        </tr>
      </thead>
      <tbody>
        <JoinUserGroupDialogConfigRow joinUserGroupDialogExternalLink={systemConfig.joinUserGroupDialogExternalLink} />
      </tbody>
    </Table>
  );
}

import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserGroupGraphDatabase from '@/features/settings/api/user-groups/update-user-group-graph-database';

type UserGroupGraphDatabaseRowProps = Readonly<{
  userGroupId: string;
  isEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupGraphDatabaseRow({ 
  userGroupId,
  isEnabled,
  isAdmin: _isAdmin,
}: UserGroupGraphDatabaseRowProps) {

  const {
    mutateAsync: updateUserGroupGraphDatabase,
    error: updateUserGroupGraphDatabaseError,
  } = useUpdateUserGroupGraphDatabase();

  const toggleUserGroupGraphDatabase = async (checked: boolean) => {
    try {
      await updateUserGroupGraphDatabase({
        userGroupId,
        graphDatabaseEnabled: checked,
      });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-graph-database-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupGraphDatabaseError?.message ??
          'Could not update User Group\'s Graph Database setting.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='user-group-graph-database-row'>
      <td>
        Neo4j
      </td>
      <td>
        <Group position='center'>
          <Switch
            data-testid='graph-database-switch'
            aria-label='Enable graph-enhanced search for this user group'
            checked={isEnabled}
            onChange={(event) => toggleUserGroupGraphDatabase(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

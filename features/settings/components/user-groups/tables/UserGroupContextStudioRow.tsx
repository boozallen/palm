import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserGroupContextStudioAccess from '@/features/settings/api/user-groups/update-user-group-context-studio-access';

type UserGroupContextStudioRowProps = Readonly<{
  userGroupId: string;
  isEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupContextStudioRow({
  userGroupId,
  isEnabled,
  isAdmin: _isAdmin,
}: UserGroupContextStudioRowProps) {

  const {
    mutateAsync: updateUserGroupContextStudioAccess,
    error: updateUserGroupContextStudioAccessError,
  } = useUpdateUserGroupContextStudioAccess();

  const toggleUserGroupContextStudio = async (checked: boolean) => {
    try {
      await updateUserGroupContextStudioAccess({
        userGroupId,
        contextStudioEnabled: checked,
      });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-context-studio-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupContextStudioAccessError?.message ??
          'Could not update User Group\'s Context Studio setting.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='user-group-context-studio-row'>
      <td>
        Context Studio
      </td>
      <td>
        <Group position='center'>
          <Switch
            data-testid='context-studio-switch'
            aria-label='Enable Context Studio for this user group'
            checked={isEnabled}
            onChange={(event) => toggleUserGroupContextStudio(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserGroupWorkflows from '@/features/settings/api/user-groups/update-user-group-workflows';

type UserGroupWorkflowsRowProps = Readonly<{
  userGroupId: string;
  isEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupWorkflowsRow({ 
  userGroupId,
  isEnabled,
  isAdmin: _isAdmin,
}: UserGroupWorkflowsRowProps) {

  const {
    mutateAsync: updateUserGroupWorkflows,
    error: updateUserGroupWorkflowsError,
  } = useUpdateUserGroupWorkflows();

  const toggleUserGroupWorkflows = async (checked: boolean) => {
    try {
      await updateUserGroupWorkflows({
        userGroupId,
        workflowsEnabled: checked,
      });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-workflows-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupWorkflowsError?.message ??
          'Could not update User Group\'s Workflows setting.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='user-group-workflows-row'>
      <td>
        Workflows
      </td>
      <td>
        <Group position='center'>
          <Switch
            data-testid='workflows-switch'
            aria-label='Enable workflows for this user group'
            checked={isEnabled}
            onChange={(event) => toggleUserGroupWorkflows(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}
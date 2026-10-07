import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupAgentProviders from '@/features/settings/api/user-groups/update-user-group-agent-providers';

type UserGroupAgentProviderRowProps = Readonly<{
  agentProvider: {
    id: string;
    name: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

export default function UserGroupAgentProviderRow({ agentProvider, userGroupId, isEnabled }: UserGroupAgentProviderRowProps) {

  const {
    mutateAsync: updateUserGroupAgentProviders,
    error: updateUserGroupAgentProvidersError,
  } = useUpdateUserGroupAgentProviders();

  const toggleUserGroupAgentProviders = async (checked: boolean) => {
    try {
      await updateUserGroupAgentProviders({ agentProviderId: agentProvider.id, userGroupId: userGroupId, enabled: checked });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-agent-providers-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupAgentProvidersError?.message ??
          'Could not update User Group\'s Agent Providers.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid={`${agentProvider.id}-user-group-agent-provider-row`}>
      <td>{agentProvider.name}</td>
      <td>
        <Group position='center'>
          <Switch
            aria-label={`Enable user group agent provider ${agentProvider.name}`}
            checked={isEnabled}
            onChange={(event) => toggleUserGroupAgentProviders(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

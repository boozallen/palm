import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupAiProviders from '@/features/settings/api/user-groups/update-user-group-ai-providers';

type UserGroupAiProviderRowProps = Readonly<{
  aiProvider: {
    id: string;
    label: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

export default function UserGroupAiProviderRow({ aiProvider, userGroupId, isEnabled }: UserGroupAiProviderRowProps) {

  const {
    mutateAsync: updateUserGroupAiProviders,
    error: updateUserGroupAiProvidersError,
  } = useUpdateUserGroupAiProviders();

  const toggleUserGroupAiProviders = async (checked: boolean) => {
    try {
      await updateUserGroupAiProviders({ aiProviderId: aiProvider.id, userGroupId: userGroupId, enabled: checked });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-ai-providers-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupAiProvidersError?.message ??
          'Could not update User Group\'s AI Providers.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid={`${aiProvider.id}-user-group-ai-provider-row`}>
      <td>{aiProvider.label}</td>
      <td>
        <Group position='center'>
          <Switch
            aria-label={`Enable user group AI provider ${aiProvider.label}`}
            checked={isEnabled}
            onChange={(event) => toggleUserGroupAiProviders(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

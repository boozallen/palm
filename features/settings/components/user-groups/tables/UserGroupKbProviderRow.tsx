import { Switch } from '@mantine/core';
import { useUpdateUserGroupKbProviders } from '@/features/settings/api/update-user-group-kb-providers';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

type KbProvider = {
  id: string;
  label: string;
  updatedAt: Date;
};

type UserGroupKbProviderRowProps = Readonly<{
  kbProvider: KbProvider;
  userGroupId: string
  isEnabled: boolean
}>;

export default function UserGroupKbProviderRow(
  { kbProvider, isEnabled, userGroupId }: UserGroupKbProviderRowProps
) {

  const {
    mutateAsync: updateUserGroupKbProviders,
    error: updateUserGroupKbProvidersError,
  } = useUpdateUserGroupKbProviders();

  const toggleUserGroupKbProviders = async (checked: boolean) => {
    try {
      await updateUserGroupKbProviders({ kbProviderId: kbProvider.id, userGroupId: userGroupId, enabled: checked });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-kb-providers-failed',
        title: 'Failed to Update User Group',
        message:
          updateUserGroupKbProvidersError?.message ??
          'Could not update User Group Kb Providers.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };
  return (
    <tr>
      <td>{kbProvider.label}</td>
      <td>
        <Switch
          aria-label={`Enable user group knowledge base ${kbProvider.label}`}
          checked={isEnabled}
          onChange={(event) => toggleUserGroupKbProviders(event.currentTarget.checked)}
        />
      </td>
    </tr>
  );

}

import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupGitHubProviders from '@/features/settings/api/user-groups/update-user-group-github-providers';

type UserGroupGitHubProviderRowProps = Readonly<{
  githubProvider: {
    id: string;
    label: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

export default function UserGroupGitHubProviderRow({ githubProvider, userGroupId, isEnabled }: UserGroupGitHubProviderRowProps) {

  const {
    mutateAsync: updateUserGroupGitHubProviders,
    error: updateUserGroupGitHubProvidersError,
  } = useUpdateUserGroupGitHubProviders();

  const toggleUserGroupGitHubProviders = async (checked: boolean) => {
    try {
      await updateUserGroupGitHubProviders({ githubProviderId: githubProvider.id, userGroupId: userGroupId, enabled: checked });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-github-providers-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupGitHubProvidersError?.message ??
          'Could not update User Group\'s GitHub Providers.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid={`${githubProvider.id}-user-group-github-provider-row`}>
      <td>{githubProvider.label}</td>
      <td>
        <Group position='center'>
          <Switch
            aria-label={`Enable user group GitHub provider ${githubProvider.label}`}
            checked={isEnabled}
            onChange={(event) => toggleUserGroupGitHubProviders(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

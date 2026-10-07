import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateUserGroupArtifactTemplates from '@/features/settings/api/user-groups/update-user-group-artifact-templates';

type UserGroupArtifactTemplateRowProps = Readonly<{
  template: {
    id: string;
    filename: string;
  };
  userGroupId: string;
  isEnabled: boolean;
}>;

export default function UserGroupArtifactTemplateRow({
  template,
  userGroupId,
  isEnabled,
}: UserGroupArtifactTemplateRowProps) {
  const {
    mutateAsync: updateUserGroupArtifactTemplates,
    error: updateError,
  } = useUpdateUserGroupArtifactTemplates();

  const toggle = async (checked: boolean) => {
    try {
      await updateUserGroupArtifactTemplates({
        templateId: template.id,
        userGroupId,
        enabled: checked,
      });
    } catch {
      notifications.show({
        id: 'update-user-group-artifact-templates-failed',
        title: 'Failed to Update',
        message: updateError?.message ?? 'Could not update User Group\'s Artifact Templates.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid={`${template.id}-user-group-artifact-template-row`}>
      <td>{template.filename}</td>
      <td>
        <Group position='center'>
          <Switch
            aria-label={`Enable artifact template ${template.filename} for user group`}
            checked={isEnabled}
            onChange={(event) => toggle(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

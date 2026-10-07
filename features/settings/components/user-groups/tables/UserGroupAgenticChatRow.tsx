import { Group, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateUserGroupAgenticChat from '@/features/settings/api/user-groups/update-user-group-agentic-chat';

type UserGroupAgenticChatRowProps = Readonly<{
  userGroupId: string;
  isEnabled: boolean;
  isAdmin: boolean;
}>;

export default function UserGroupAgenticChatRow({
  userGroupId,
  isEnabled,
  isAdmin: _isAdmin,
}: UserGroupAgenticChatRowProps) {
  const {
    mutateAsync: updateUserGroupAgenticChat,
    error: updateUserGroupAgenticChatError,
  } = useUpdateUserGroupAgenticChat();

  const toggleUserGroupAgenticChat = async (checked: boolean) => {
    try {
      await updateUserGroupAgenticChat({
        userGroupId,
        agenticChatEnabled: checked,
      });
    } catch (error) {
      notifications.show({
        id: 'update-user-group-agentic-chat-failed',
        title: 'Failed to Update',
        message:
          updateUserGroupAgenticChatError?.message ??
          'Could not update User Group\'s Agentic Chat setting.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <tr data-testid='user-group-agentic-chat-row'>
      <td>
        Agentic Chat
      </td>
      <td>
        <Group position='center'>
          <Switch
            data-testid='agentic-chat-switch'
            aria-label='Enable agentic chat for this user group'
            checked={isEnabled}
            onChange={(event) => toggleUserGroupAgenticChat(event.currentTarget.checked)}
          />
        </Group>
      </td>
    </tr>
  );
}

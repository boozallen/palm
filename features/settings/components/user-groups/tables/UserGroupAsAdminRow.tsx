import { Group, Anchor, ActionIcon, Flex } from '@mantine/core';
import { IconUsers, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';

import { UserGroup, UserGroupRole } from '@/features/shared/types/user-group';
import DeleteUserGroupModal from '@/features/settings/components/user-groups/modals/DeleteUserGroupModal';

export type UserGroupAsAdminRowProps = Readonly<{
  userGroup: UserGroup;
  selectedUserRole?: UserGroupRole;
}>;

export default function UserGroupAsAdminRow({ userGroup, selectedUserRole }: UserGroupAsAdminRowProps) {

  const [
    deleteUserGroupModalOpened,
    {
      open: openDeleteUserGroupModal,
      close: closeDeleteUserGroupModal,
    },
  ] = useDisclosure(false);

  return (
    <>
      <DeleteUserGroupModal
        modalOpened={deleteUserGroupModalOpened}
        closeModalHandler={closeDeleteUserGroupModal}
        userGroupId={userGroup.id}
      />

      <tr data-testid={`${userGroup.id}-user-group-as-admin-row`}>
        <td>
          <Anchor
            href={`/settings/user-groups/${userGroup.id}`}
            component={Link}
          >
            {userGroup.label}
          </Anchor>
        </td>

        <td>
          <Group position='center'>
            <IconUsers stroke={1.5} />
            {userGroup.memberCount.toString()}
          </Group>
        </td>
        {selectedUserRole && (
          <td data-testid={`${userGroup.id}-selected-user-role`}>
            {selectedUserRole}
          </td>
        )}

        <td>
          <Flex justify='flex-end' align='center'>
            <ActionIcon
              onClick={openDeleteUserGroupModal}
              data-testid={`${userGroup.id}-delete`}
              aria-label='Delete user group'
            >
              <IconTrash />
            </ActionIcon>
          </Flex>
        </td>
      </tr>
    </>
  );
}

import { Group, Anchor, ActionIcon, Flex } from '@mantine/core';
import { UserGroup } from '@/features/shared/types/user-group';
import { IconUsers, IconTrash } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import DeleteUserGroupModal from '@/features/settings/components/user-groups/modals/DeleteUserGroupModal';

export type UserGroupAsAdminRowProps = Readonly<{
  userGroup: UserGroup;
}>;

export default function UserGroupAsAdminRow({ userGroup }: UserGroupAsAdminRowProps) {

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
          <Anchor href={`/settings/user-groups/${userGroup.id}`}>
            {userGroup.label}
          </Anchor>
        </td>

        <td>
          <Group position='center'>
            <IconUsers stroke={1.5} />
            {userGroup.memberCount.toString()}
          </Group>
        </td>
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

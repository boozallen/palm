import { Group, Select, ActionIcon } from '@mantine/core';
import { IconCheck, IconTrash, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useSession } from 'next-auth/react';

import {
  UserGroupRole,
  UserGroupRoleInputOptions,
  UserGroupMembership,
} from '@/features/shared/types/user-group';
import useUpdateUserGroupMemberRole from '@/features/settings/api/user-groups/update-user-group-member-role';
import DeleteUserGroupMemberModal from '@/features/settings/components/user-groups/modals/DeleteUserGroupMemberModal';
import RoleDemotionConfirmationModal from '@/features/settings/components/user-groups/modals/RoleDemotionConfirmationModal';
import { UserRole } from '@/features/shared/types/user';

export type UserGroupMemberRowProps = Readonly<{
  userGroupMember: UserGroupMembership;
}>;

export default function UserGroupMemberRow({
  userGroupMember,
}: UserGroupMemberRowProps) {
  const [
    deleteUserGroupMemberModalOpened,
    {
      open: openDeleteUserGroupMemberModal,
      close: closeDeleteUserGroupMemberModal,
    },
  ] = useDisclosure(false);

  const [
    roleDemotionConfirmationModalOpened,
    {
      open: openRoleDemotionConfirmationModal,
      close: closeRoleDemotionConfirmationModal,
    },
  ] = useDisclosure(false);

  const session = useSession();
  const userRole = session.data?.user.role;

  const [selectedRole, setSelectedRole] = useState(userGroupMember.role);

  const { mutateAsync: updateMemberRole, error: updateMemberRoleError } =
    useUpdateUserGroupMemberRole();

  const handleRoleChange = async (newRole: UserGroupRole) => {
    if (selectedRole === UserGroupRole.Lead && userRole !== UserRole.Admin && userGroupMember.userId === session.data?.user.id) {
      openRoleDemotionConfirmationModal();
    } else {
      performRoleUpdate(newRole);
    }
    setSelectedRole(newRole);
  };

  const performRoleUpdate = async (newRole: UserGroupRole) => {
    let updateSuccessful;

    try {
      await updateMemberRole({
        userGroupId: userGroupMember.userGroupId,
        userId: userGroupMember.userId,
        role: newRole,
      });
      updateSuccessful = true;
    } catch (error) {
      updateSuccessful = false;
    }

    notifications.show({
      id: 'update-user-group-membership-role',
      title: updateSuccessful ? 'Membership Role Updated' : 'Failed to Update',
      message: updateSuccessful
        ? 'Successfully updated user\'s membership role'
        : updateMemberRoleError?.message ??
        'Could not update user group membership role.',
      icon: updateSuccessful ? <IconCheck /> : <IconX />,
      variant: updateSuccessful ? 'successful_operation' : 'failed_operation',
      autoClose: updateSuccessful,
    });
    closeRoleDemotionConfirmationModal();
  };

  const userLastLogin = userGroupMember.lastLoginAt ? 
    new Date(userGroupMember.lastLoginAt).toLocaleString(undefined, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) : 'Never';

  return (
    <>
      <DeleteUserGroupMemberModal
        modalOpened={deleteUserGroupMemberModalOpened}
        closeModalHandler={closeDeleteUserGroupMemberModal}
        userGroupId={userGroupMember.userGroupId}
        userId={userGroupMember.userId}
      />
      <RoleDemotionConfirmationModal
        modalOpened={roleDemotionConfirmationModalOpened}
        closeModalHandler={() => {
          closeRoleDemotionConfirmationModal();
          setSelectedRole(UserGroupRole.Lead);
        }}
        onConfirm={() => performRoleUpdate(selectedRole)}
      />
      <tr data-testid={`${userGroupMember.userGroupId}-user-group-member-row`}>
        <td>{userGroupMember.name}</td>
        <td>{userGroupMember.email}</td>
        <td>{userLastLogin}</td>
        <td>
          <Group align='center'>
            <Select
              aria-label='User group role'
              variant='default'
              data-testid='user-group-member-role-select'
              data={UserGroupRoleInputOptions}
              value={selectedRole}
              mb='0'
              onChange={(value: UserGroupRole) => {
                if (value !== selectedRole) {
                  handleRoleChange(value);
                }
              }}
            />
          </Group>
        </td>
        <td>
          {(userGroupMember.userId !== session.data?.user.id ||
            userRole === UserRole.Admin) && (
              <ActionIcon
                onClick={openDeleteUserGroupMemberModal}
                data-testid={`${userGroupMember.userId}-delete`}
                aria-label='Delete member'
              >
                <IconTrash />
              </ActionIcon>
            )}
        </td>
      </tr>
    </>
  );
}

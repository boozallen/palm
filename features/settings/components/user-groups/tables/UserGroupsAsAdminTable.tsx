import { useMemo, useState } from 'react';
import { Box, Stack, Table, Text } from '@mantine/core';
import UserGroupsAsAdminTableHead from './UserGroupsAsAdminTableHead';
import UserGroupsAsAdminTableBody from './UserGroupsAsAdminTableBody';
import UserGroupsUserFilter from '@/features/settings/components/user-groups/elements/UserGroupsUserFilter';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import useGetUserGroupMembershipsByUser from '@/features/settings/api/user-groups/get-user-group-memberships-by-user';
import { SelectedUser } from '@/features/settings/types';
import { UserGroupRole } from '@/features/shared/types/user-group';
import Loading from '@/features/shared/components/Loading';

export default function UserGroupsAsAdminTable() {
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null);

  const {
    data: userGroupData,
    isPending: userGroupsIsPending,
    error: userGroupsError,
  } = useGetUserGroups();

  const {
    data: membershipData,
    isPending: membershipsIsPending,
    error: membershipsError,
  } = useGetUserGroupMembershipsByUser(selectedUser?.id ?? '');

  const userGroups = useMemo(
    () =>
      userGroupData?.userGroups.map((group) => ({
        ...group,
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(group.updatedAt),
        workflowsEnabled: group.workflowsEnabled ?? false,
        agenticChatEnabled: group.agenticChatEnabled ?? false,
        contextStudioEnabled: group.contextStudioEnabled ?? false,
      })),
    [userGroupData]
  );

  const rolesByUserGroupId = useMemo(() => {
    if (!selectedUser || !membershipData) {
      return undefined;
    }

    return membershipData.memberships.reduce<Record<string, UserGroupRole>>(
      (roles, membership) => {
        roles[membership.userGroupId] = membership.role;
        return roles;
      },
      {}
    );
  }, [selectedUser, membershipData]);

  const visibleUserGroups = useMemo(() => {
    if (!userGroups || !rolesByUserGroupId) {
      return userGroups;
    }

    return userGroups.filter((group) => group.id in rolesByUserGroupId);
  }, [userGroups, rolesByUserGroupId]);

  if (userGroupsIsPending) {
    return <Loading />;
  }

  if (userGroupsError) {
    return <Text>{userGroupsError.message}</Text>;
  }

  if (!userGroups || userGroups.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No user groups have been created yet.</Text>
      </Box>
    );
  }

  function renderUserGroups() {
    if (selectedUser && membershipsIsPending) {
      return <Loading />;
    }

    if (selectedUser && membershipsError) {
      return <Text>{membershipsError.message}</Text>;
    }

    const groups = visibleUserGroups ?? [];

    if (selectedUser && groups.length === 0) {
      return (
        <Box bg='dark.8' p='md'>
          <Text c='gray.4'>
            {selectedUser.name} is not a member of any user group.
          </Text>
        </Box>
      );
    }

    return (
      <Box bg='dark.6' p='md'>
        <Table data-testid='user-groups-as-admin-table'>
          <UserGroupsAsAdminTableHead
            showSelectedUserRole={!!rolesByUserGroupId}
          />
          <UserGroupsAsAdminTableBody
            userGroups={groups}
            rolesByUserGroupId={rolesByUserGroupId}
          />
        </Table>
      </Box>
    );
  }

  return (
    <Stack spacing='md'>
      <UserGroupsUserFilter
        selectedUser={selectedUser}
        onSelectedUserChange={setSelectedUser}
      />
      {renderUserGroups()}
    </Stack>
  );
}

import { useMemo } from 'react';
import { Box, Table, Text } from '@mantine/core';
import UserGroupsAsAdminTableHead from './UserGroupsAsAdminTableHead';
import UserGroupsAsAdminTableBody from './UserGroupsAsAdminTableBody';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import Loading from '@/features/shared/components/Loading';

export default function UserGroupsAsAdminTable() {
  const {
    data: userGroupData,
    isPending: userGroupsIsPending,
    error: userGroupsError,
  } = useGetUserGroups();

  const userGroups = useMemo(
    () =>
      userGroupData?.userGroups.map((group) => ({
        ...group,
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(group.updatedAt),
      })),
    [userGroupData]
  );

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

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='user-groups-as-admin-table'>
        <UserGroupsAsAdminTableHead />
        <UserGroupsAsAdminTableBody userGroups={userGroups} />
      </Table>
    </Box>
  );
}

import { useMemo } from 'react';
import { Box, Table, Text } from '@mantine/core';
import UserGroupsAsLeadTableHead from './UserGroupsAsLeadTableHead';
import UserGroupsAsLeadTableBody from './UserGroupsAsLeadTableBody';
import useGetUserGroupsAsLead from '@/features/settings/api/user-groups/get-user-groups-as-lead';
import Loading from '@/features/shared/components/Loading';

export default function UserGroupsAsLeadTable() {
  const {
    data: userGroupsAsLeadData,
    isPending: userGroupsAsLeadIsPending,
    error: userGroupsAsLeadError,
  } = useGetUserGroupsAsLead();

  const userGroups = useMemo(
    () =>
      userGroupsAsLeadData?.userGroupsAsLead.map((group) => ({
        ...group,
        createdAt: new Date(group.createdAt),
        updatedAt: new Date(group.updatedAt),
      })),
    [userGroupsAsLeadData]
  );

  if (userGroupsAsLeadIsPending) {
    return <Loading />;
  }

  if (userGroupsAsLeadError) {
    return <Text>{userGroupsAsLeadError.message}</Text>;
  }

  if (!userGroups || userGroups.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        {/* this should hypothetically not be reached */}
        <Text c='gray.4'>You are not a lead of any user group.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='user-groups-as-lead-table'>
        <UserGroupsAsLeadTableHead />
        <UserGroupsAsLeadTableBody userGroups={userGroups} />
      </Table>
    </Box>
  );
}

import { Table, Text } from '@mantine/core';
import useGetUserGroups from '@/features/profile/api/get-user-groups';
import Loading from '@/features/shared/components/Loading';
import UserGroupRow from './UserGroupRow';

export default function UserGroupsTable() {
  const {
    data: userGroups,
    isPending: userGroupsIsPending,
    error: userGroupsError,
  } = useGetUserGroups();

  if (userGroupsIsPending) {
    return <Loading />;
  }

  if (userGroupsError) {
    return <Text>{userGroupsError.message}</Text>;
  }

  if (!userGroups || !userGroups.userGroups.length) {
    return <Text>Not a member of any user groups.</Text>;
  }

  return (
    <Table>
      <thead>
        <tr>
          <th>Group</th>
          <th>Role</th>
        </tr>
      </thead>
      <tbody>
        {userGroups.userGroups.map(
          group => <UserGroupRow key={group.id} group={group} />
        )}
      </tbody>
    </Table>
  );
}

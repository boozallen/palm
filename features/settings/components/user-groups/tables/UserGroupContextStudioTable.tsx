import { Box, Text, Table } from '@mantine/core';
import { JSX } from 'react';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';
import UserGroupContextStudioTableHead from './UserGroupContextStudioTableHead';
import UserGroupContextStudioTableBody from './UserGroupContextStudioTableBody';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';
import Loading from '@/features/shared/components/Loading';

type UserGroupContextStudioTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupContextStudioTable({
  id,
}: UserGroupContextStudioTableProps): JSX.Element {
  const session = useSession();
  const userRole = session.data?.user.role;
  const isAdmin = userRole === UserRole.Admin;

  const {
    data: userGroup,
    isPending: userGroupIsPending,
    error: userGroupError,
  } = useGetUserGroup(id);

  if (userGroupIsPending) {
    return <Loading />;
  }

  if (userGroupError) {
    return <Text>{userGroupError.message}</Text>;
  }

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='user-group-context-studio-table'>
        <UserGroupContextStudioTableHead />
        <UserGroupContextStudioTableBody
          userGroupId={id}
          contextStudioEnabled={userGroup.contextStudioEnabled}
          isAdmin={isAdmin}
        />
      </Table>
    </Box>
  );
}

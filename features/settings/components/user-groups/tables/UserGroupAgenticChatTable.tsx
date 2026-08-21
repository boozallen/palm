import { Box, Text, Table } from '@mantine/core';
import { JSX } from 'react';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';
import UserGroupAgenticChatTableHead from './UserGroupAgenticChatTableHead';
import UserGroupAgenticChatTableBody from './UserGroupAgenticChatTableBody';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';
import Loading from '@/features/shared/components/Loading';

type UserGroupAgenticChatTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupAgenticChatTable({
  id,
}: UserGroupAgenticChatTableProps): JSX.Element {
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
      <Table data-testid='user-group-agentic-chat-table'>
        <UserGroupAgenticChatTableHead />
        <UserGroupAgenticChatTableBody
          userGroupId={id}
          agenticChatEnabled={userGroup.agenticChatEnabled}
          isAdmin={isAdmin}
        />
      </Table>
    </Box>
  );
}

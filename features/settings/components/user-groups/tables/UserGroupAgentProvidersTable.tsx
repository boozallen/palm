import { Box, Table, Text } from '@mantine/core';
import UserGroupAgentProvidersTableHead from './UserGroupAgentProvidersTableHead';
import UserGroupAgentProvidersTableBody from './UserGroupAgentProvidersTableBody';
import useGetAgentProviders from '@/features/settings/api/agent-providers/get-agent-providers';
import useGetUserGroupAgentProviders from '@/features/settings/api/user-groups/get-user-group-agent-providers';
import Loading from '@/features/shared/components/Loading';
import { JSX } from 'react';

type UserGroupAgentProvidersTableProps = Readonly<{
  id: string;
}>;

export default function UserGroupAgentProvidersTable({ id }: UserGroupAgentProvidersTableProps): JSX.Element {

  const {
    data: agentProviders,
    isPending: agentProvidersIsPending,
    error: agentProvidersError,
  } = useGetAgentProviders();

  const {
    data: userGroupAgentProviders,
    isPending: userGroupAgentProvidersIsPending,
    error: userGroupAgentProvidersError,
  } = useGetUserGroupAgentProviders(id);

  if (agentProvidersIsPending || userGroupAgentProvidersIsPending) {
    return <Loading />;
  }

  if (agentProvidersError) {
    return <Text>{agentProvidersError.message}</Text>;
  }
  else if (userGroupAgentProvidersError) {
    return <Text>{userGroupAgentProvidersError.message}</Text>;
  }

  if (!agentProviders.agentProviders || agentProviders.agentProviders.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No Agent Providers have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupAgentProviderIds = userGroupAgentProviders?.userGroupAgentProviders.map(provider => provider.id) || [];

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='user-group-agent-providers-table'>
        <UserGroupAgentProvidersTableHead />
        <UserGroupAgentProvidersTableBody
          agentProviders={agentProviders.agentProviders}
          userGroupAgentProviders={userGroupAgentProviderIds}
          userGroupId={id}
        />
      </Table>
    </Box>
  );
}

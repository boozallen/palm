import { Box, Table, Text } from '@mantine/core';
import UserGroupAiAgentsTableHead from './UserGroupAiAgentsTableHead';
import UserGroupAiAgentsTableBody from './UserGroupAiAgentsTableBody';
import useGetAiAgents from '@/features/settings/api/ai-agents/get-ai-agents';
import useGetUserGroupAiAgents from '@/features/settings/api/get-user-group-ai-agents';
import Loading from '@/features/shared/components/Loading';
import { JSX } from 'react';

type UserGroupAiAgentTableProps = Readonly<{
  id: string;
}>;
export default function UserGroupAiAgentsTable({ id }: UserGroupAiAgentTableProps): JSX.Element {

  const {
    data: aiAgents,
    isPending: aiAgentsIsPending,
    error: aiAgentsError,
  } = useGetAiAgents();

  const {
    data: userGroupAiAgents,
    isPending: userGroupAiAgentsIsPending,
    error: userGroupAiAgentsError,
  } = useGetUserGroupAiAgents(id);

  if (aiAgentsIsPending || userGroupAiAgentsIsPending) {
    return <Loading />;
  }

  if (aiAgentsError) {
    return <Text>{aiAgentsError.message}</Text>;
  }
  else if (userGroupAiAgentsError) {
    return <Text>{userGroupAiAgentsError.message}</Text>;
  }

  if (!aiAgents.aiAgents.length) {

    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No AI agents have been configured yet.</Text>
      </Box>
    );
  }

  const userGroupAiAgentIds = userGroupAiAgents.userGroupAiAgents.map(agent => agent.id) || [];

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='user-group-ai-agents-table'>
        <UserGroupAiAgentsTableHead />
        <UserGroupAiAgentsTableBody
          aiAgents={aiAgents.aiAgents}
          userGroupAiAgents={userGroupAiAgentIds}
          userGroupId={id}
        />
      </Table>
    </Box>
  );
}


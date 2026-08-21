import { Box, Table, Text } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import useGetAgentProviders from '@/features/settings/api/agent-providers/get-agent-providers';
import AgentProvidersTableHead from './AgentProvidersTableHead';
import AgentProvidersTableBody from './AgentProvidersTableBody';
import { JSX } from 'react';

const TableWrapper = ({ children }: { children: JSX.Element }): JSX.Element => {
  return (
    <table>
      <tbody>
        <tr>
          <td>{children}</td>
        </tr>
      </tbody>
    </table>
  );
};

export default function AgentProvidersTable() {
  const {
    data: agentProvidersData,
    isPending,
    error,
  } = useGetAgentProviders();

  if (isPending) {
    return (
      <TableWrapper>
        <Loading />
      </TableWrapper>
    );
  }

  if (error) {
    return (
      <TableWrapper>
        <Text>{error.message}</Text>
      </TableWrapper>
    );
  }

  if (!agentProvidersData.agentProviders || agentProvidersData.agentProviders.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No Agent Providers have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='agent-providers-table'>
        <AgentProvidersTableHead />
        <AgentProvidersTableBody agentProviders={agentProvidersData.agentProviders} />
      </Table>
    </Box>
  );
}

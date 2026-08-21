import { Box, Table, Text } from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import AgentServicesTableHead from './AgentServicesTableHead';
import AgentServicesTableBody from './AgentServicesTableBody';
import { JSX } from 'react';
import useGetAgentServices from '@/features/settings/api/agent-services/get-agent-services';

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

type AgentService = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

export default function AgentServicesTable() {
  const {
    data,
    isPending,
    error,
  } = useGetAgentServices();

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

  if (!data?.services || data.services.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No Agent Services have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='md'>
      <Table data-testid='agent-services-table'>
        <AgentServicesTableHead />
        <AgentServicesTableBody services={data.services} />
      </Table>
    </Box>
  );
}

import {
  Box,
  Table,
  Text,
} from '@mantine/core';
import Loading from '@/features/shared/components/Loading';
import getAiProviders from '@/features/settings/api/ai-providers/get-ai-providers';
import AiProvidersTableHead from './AiProvidersTableHead';
import AiProvidersTableBody from './AiProvidersTableBody';
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

export default function AiProvidersTable() {
  const {
    data: aiProvidersData,
    isPending: getAiProvidersIsPending,
    error: getAiProvidersError,
  } = getAiProviders();

  if (getAiProvidersIsPending) {
    return (
      <TableWrapper>
        <Loading />
      </TableWrapper>
    );
  }

  if (getAiProvidersError) {
    return (
      <TableWrapper>
        <Text>{getAiProvidersError?.message}</Text>
      </TableWrapper>
    );
  }

  if (!aiProvidersData.aiProviders || aiProvidersData.aiProviders.length === 0) {

    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No AI Providers have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Box bg='dark.6' p='xl'>
      <Table data-testid='ai-providers-table'>
        <AiProvidersTableHead />
        <AiProvidersTableBody aiProviders={aiProvidersData.aiProviders} />
      </Table>
    </Box>
  );
}


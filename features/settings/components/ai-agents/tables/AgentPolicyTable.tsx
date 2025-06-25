import { useEffect, useMemo, useState } from 'react';
import { Box, Pagination, Stack, Table, Text } from '@mantine/core';

import AgentPolicyRow from './AgentPolicyRow';
import useGetCertaPolicies from '@/features/settings/api/ai-agents/certa/get-certa-policies';
import Loading from '@/features/shared/components/Loading';
import { ITEMS_PER_PAGE } from '@/features/shared/utils';

type AgentPolicyTableProps = Readonly<{
  aiAgentId: string;
}>;

export default function AgentPolicyTable({ aiAgentId }: AgentPolicyTableProps) {
  const { data: agentPolicies, isPending: agentPoliciesIsPending } =
    useGetCertaPolicies(aiAgentId);

  /* IMPLEMENT PAGINATION */
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = useMemo(() => {
    if (!agentPolicies?.policies?.length) {
      return 1;
    }

    return Math.ceil(agentPolicies.policies.length / ITEMS_PER_PAGE);
  }, [agentPolicies]);

  const paginatedPolicies = useMemo(() => {
    if (!agentPolicies) {
      return [];
    }

    const indexOfFirstPolicy = (currentPage - 1) * ITEMS_PER_PAGE;
    const indexOfLastPolicy = currentPage * ITEMS_PER_PAGE;

    return agentPolicies.policies.slice(indexOfFirstPolicy, indexOfLastPolicy);
  }, [currentPage, agentPolicies]);

  /* HANDLE CASE WHERE TOTAL PAGES CHANGES AND CURRENT PAGE IS NO LONGER AVAILABLE */
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (agentPoliciesIsPending) {
    return <Loading />;
  }

  if (!agentPolicies?.policies.length) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No policies have been configured yet.</Text>
      </Box>
    );
  }

  return (
    <Stack bg='dark.6' p='xl' spacing='lg'>
      <Table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Content</th>
            <th>Requirements</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {paginatedPolicies.map((policy) => (
            <AgentPolicyRow key={policy.id} policy={policy} />
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={currentPage}
          onChange={handleChangePage}
          data-testid='policies-pagination'
          position='right'
          getControlProps={(control) => {
            switch (control) {
              case 'previous':
                return { 'aria-label': 'Previous' };
              case 'next':
                return { 'aria-label': 'Next' };
              default:
                return {};
            }
          }}
        />
      )}
    </Stack>
  );
}

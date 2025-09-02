import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { SimpleGrid, Stack, Text, Title } from '@mantine/core';

import Agent from '@/features/ai-agents/components/Agent';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';
import Loading from '@/features/shared/components/Loading';
import Breadcrumbs from '@/components/elements/Breadcrumbs';

export default function AgentDetailsPage() {
  const router = useRouter();
  const { agentId } = router.query;

  const {
    data: availableAgents,
    isPending: availableAgentsIsLoading,
  } = useGetAvailableAgents();

  const agent = useMemo(() => {
    return availableAgents?.availableAgents.find((agent) => agent.id === agentId);
  }, [availableAgents, agentId]);

  if (availableAgentsIsLoading) {
    return <Loading />;
  }

  if (!availableAgents?.availableAgents.length || !agent) {
    return null;
  }

  const links = [
    { title: 'AI Agents', href: '/ai-agents' },
    { title: agent.label, href: null },
  ];

  return (
    <>
      <SimpleGrid cols={1} p='xl' bg='dark.6' data-testid='agent-page-name'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            {agent.label}
          </Title>
          <Text fz='md' c='gray.6'>
            {agent.description}
          </Text>
        </Stack>
        <Breadcrumbs links={links} />
      </SimpleGrid>

      <Stack p='xl' spacing='md'>
        <Agent label={agent.label} id={agent.id} type={agent.type} />
      </Stack>
    </>
  );
}

import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Anchor, Breadcrumbs, SimpleGrid, Stack, Text, Title } from '@mantine/core';

import Agent from '@/features/ai-agents/components/Agent';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';
import Loading from '@/features/shared/components/Loading';

export default function AgentDetailsPage() {
  const router = useRouter();
  const { agentId, agentSlug } = router.query;

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

  const breadCrumbs = [
    { title: 'AI Agents', href: '/ai-agents' },
    { title: agent.name, href: `/ai-agents/${agentSlug}` },
  ].map(({ title, href }) => (<Anchor href={href} key={title}>{title}</Anchor>));

  return (
    <>
      <SimpleGrid cols={2} p='xl' bg='dark.6' data-testid='agent-page-name'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            {agent.name}
          </Title>
          <Text fz='md' c='gray.6'>
            {agent.description}
          </Text>
        </Stack>
      </SimpleGrid>
      <Stack p='xl' spacing='md'>
        <Breadcrumbs>{breadCrumbs}</Breadcrumbs>
        <Agent name={agent.name} id={agent.id} type={agent.type} />
      </Stack>
    </>
  );
}

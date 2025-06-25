import { Anchor, Breadcrumbs, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useRouter } from 'next/router';

import Agent from '@/features/ai-agents/components/Agent';
import { AiAgent } from '@/features/shared/types/ai-agent';
import { generateAgentSlug } from '@/features/ai-agents/utils/agents';
import Loading from '@/features/shared/components/Loading';
import useGetAvailableAgents from '@/features/shared/api/get-available-agents';

export default function AiAgentPage() {
  const router = useRouter();
  const { agentSlug } = router.query;

  const {
    data,
    isPending: agentsIsPending,
  } = useGetAvailableAgents();

  const availableAgents = data?.availableAgents;

  const agent: AiAgent | undefined = availableAgents?.find(
    (agent) => agentSlug === generateAgentSlug(agent.name)
  );

  if (agentsIsPending) {
    return <Loading />;
  }

  if (!agent) {
    return <Text>Agent not found</Text>;
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
        <Agent name={agent.name} id={agent.id} />
      </Stack>
    </>
  );
}

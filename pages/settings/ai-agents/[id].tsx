import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';

import AgentPolicies from '@/features/settings/components/ai-agents/elements/certa/AgentPolicies';
import Loading from '@/features/shared/components/Loading';
import useGetAiAgent from '@/features/settings/api/ai-agents/get-ai-agent';

export default function AiAgentDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const {
    data: aiAgent,
    isPending: aiAgentIsPending,
  } = useGetAiAgent(id);

  const [activeTab, setActiveTab] = useState('configuration');
  const handleTabChange = (value: string | null) => {
    if (value !== null) {
      setActiveTab(value);
    }
  };

  useEffect(() => {
    const agentIsNull = !aiAgentIsPending && !aiAgent;
    if (agentIsNull) {
      router.push('/');
    }
  }, [
    aiAgent,
    aiAgentIsPending,
    router,
  ]);

  if (aiAgentIsPending) {
    return <Loading />;
  }

  if (!aiAgent) {
    return null;
  }

  return (
    <>
      <SimpleGrid cols={1} p='xl' bg='dark.6' pb='0'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            {aiAgent.name}
          </Title>
          <Text fz='md' c='gray.6'>
            {aiAgent.description}
          </Text>
        </Stack>
        <Tabs
          w='max-content'
          pt='md'
          value={activeTab}
          onTabChange={handleTabChange}
        >
          <Tabs.List>
            <Tabs.Tab value='configuration' pl='0'>Configuration</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </SimpleGrid>
      <Box mx='xl' pt='xl'>
        {activeTab === 'configuration' && <AgentPolicies aiAgentId={id} />}
      </Box>
    </>
  );
}

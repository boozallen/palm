import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Box, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';

import AgentPolicies from '@/features/settings/components/ai-agents/elements/certa/AgentPolicies';
import AgentChecklistItems from '@/features/settings/components/ai-agents/elements/swear/AgentChecklistItems';
import useGetAiAgent from '@/features/settings/api/ai-agents/get-ai-agent';
import Breadcrumbs from '@/components/elements/Breadcrumbs';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import { AiAgentType } from '@/features/shared/types';

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
    return <CenteredLoader />;
  }

  if (!aiAgent) {
    return null;
  }

  const links = [
    { title: 'Settings', href: '/settings' },
    { title: 'AI Agents', href: null },
    { title: aiAgent.label, href: null },
  ];

  return (
    <>
      <SimpleGrid cols={1} p='md' bg='dark.6' pb='0'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            {aiAgent.label}
          </Title>
          <Text fz='md' c='gray.6'>
            {aiAgent.description}
          </Text>
        </Stack>
        <Breadcrumbs links={links} />
        <Tabs
          w='max-content'
          value={activeTab}
          onTabChange={handleTabChange}
        >
          <Tabs.List>
            <Tabs.Tab value='configuration' pl='0'>Configuration</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </SimpleGrid>
      <Box mx='md' pt='md'>
        {activeTab === 'configuration' && aiAgent.type === AiAgentType.CERTA && (
          <AgentPolicies aiAgentId={id} />
        )}
        {activeTab === 'configuration' && aiAgent.type === AiAgentType.SWEAR && (
          <AgentChecklistItems aiAgentId={id} />
        )}
      </Box>
    </>
  );
}

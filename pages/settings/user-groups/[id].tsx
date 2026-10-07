import { useState } from 'react';
import { Title, Text, SimpleGrid, Tabs, Box, Stack } from '@mantine/core';
import { useRouter } from 'next/router';

import UserGroupMembersTable from '@/features/settings/components/user-groups/tables/UserGroupMembersTable';
import UserGroupAiProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupAiProvidersTable';
import useGetUserGroup from '@/features/settings/api/user-groups/get-user-group';
import UserGroupKbProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupKbProvidersTable';
import UserGroupAiAgentsTable from '@/features/settings/components/user-groups/tables/UserGroupAiAgentsTable';
import UserGroupGraphDatabasesTable from '@/features/settings/components/user-groups/tables/UserGroupGraphDatabasesTable';
import UserGroupWorkflowsTable from '@/features/settings/components/user-groups/tables/UserGroupWorkflowsTable';
import UserGroupAgentProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupAgentProvidersTable';
import UserGroupGitHubProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupGitHubProvidersTable';
import UserGroupContextStudioTable from '@/features/settings/components/user-groups/tables/UserGroupContextStudioTable';
import UserGroupAgenticChatTable from '@/features/settings/components/user-groups/tables/UserGroupAgenticChatTable';
import UserGroupArtifactTemplatesTable from '@/features/settings/components/user-groups/tables/UserGroupArtifactTemplatesTable';
import Breadcrumbs from '@/components/elements/Breadcrumbs';
import CenteredLoader from '@/features/shared/components/CenteredLoader';

export default function UserGroupDetailsPage() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const {
    data: userGroup,
    isPending: userGroupIsPending,
    isError: userGroupIsError,
    error: userGroupError,
  } = useGetUserGroup(id);

  const [activeTab, setActiveTab] = useState('members');

  if (userGroupIsPending) {
    return <CenteredLoader />;
  }

  if (userGroupIsError) {
    return <Text>{userGroupError.message}</Text>;
  }

  const handleTabChange = (value: string | null) => {
    if (value !== null) {
      setActiveTab(value);
    }
  };

  const links = [
    { title: 'Settings', href: '/settings' },
    { title: 'User Groups', href: '/settings#user-groups' },
    { title: userGroup.label, href: null },
  ];

  return (
    <>
      <SimpleGrid cols={1} p='md' pb='0' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            User Group
          </Title>
          <Text fz='md' c='gray.10' w='50%'>
            View and manage the resources and members assigned to {userGroup.label}
          </Text>
        </Stack>
        <Breadcrumbs links={links} />
        <Tabs
          w='max-content'
          value={activeTab}
          onTabChange={handleTabChange}
        >
          <Tabs.List>
            <Tabs.Tab value='members' pl='0'>
              Members
            </Tabs.Tab>
            <Tabs.Tab value='ai-providers'>AI Providers</Tabs.Tab>
            <Tabs.Tab value='agent-providers'>Agent Providers</Tabs.Tab>
            <Tabs.Tab value='github-providers'>GitHub Providers</Tabs.Tab>
            <Tabs.Tab value='kb-providers'>Knowledge Base Providers</Tabs.Tab>
            <Tabs.Tab value='ai-agents'>AI Agents</Tabs.Tab>
            <Tabs.Tab value='graph-databases'>Graph Databases</Tabs.Tab>
            <Tabs.Tab value='workflows'>Workflows</Tabs.Tab>
            <Tabs.Tab value='agentic-chat'>Agentic Chat</Tabs.Tab>
            <Tabs.Tab value='context-studio'>Context Studio</Tabs.Tab>
            <Tabs.Tab value='artifact-templates'>Artifact Templates</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </SimpleGrid>
      <Box mx='md' pt='md'>
        {activeTab === 'members' && <UserGroupMembersTable id={id} joinCode={userGroup.joinCode} monthlyBudget={userGroup.monthlyBudget} />}
        {activeTab === 'ai-providers' && <UserGroupAiProvidersTable id={id} />}
        {activeTab === 'kb-providers' && <UserGroupKbProvidersTable id={id} />}
        {activeTab === 'ai-agents' && <UserGroupAiAgentsTable id={id} />}
        {activeTab === 'graph-databases' && <UserGroupGraphDatabasesTable id={id} />}
        {activeTab === 'workflows' && <UserGroupWorkflowsTable id={id} />}
        {activeTab === 'agentic-chat' && <UserGroupAgenticChatTable id={id} />}
        {activeTab === 'agent-providers' && <UserGroupAgentProvidersTable id={id} />}
        {activeTab === 'github-providers' && <UserGroupGitHubProvidersTable id={id} />}
        {activeTab === 'context-studio' && <UserGroupContextStudioTable id={id} />}
        {activeTab === 'artifact-templates' && <UserGroupArtifactTemplatesTable id={id} />}
      </Box>
    </>
  );
}

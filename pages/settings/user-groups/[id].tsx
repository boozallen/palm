import { useState } from 'react';
import { Title, Text, SimpleGrid, Tabs, Box, Stack } from '@mantine/core';
import { useRouter } from 'next/router';
import Loading from '@/features/shared/components/Loading';
import UserGroupMembersTable from '@/features/settings/components/user-groups/tables/UserGroupMembersTable';
import UserGroupAiProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupAiProvidersTable';
import useGetUserGroup from '@/features/settings/api/get-user-group';
import UserGroupKbProvidersTable from '@/features/settings/components/user-groups/tables/UserGroupKbProvidersTable';
import UserGroupAiAgentsTable from '@/features/settings/components/user-groups/tables/UserGroupAiAgentsTable';

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
    return <Loading />;
  }

  if (userGroupIsError) {
    return <Text>{userGroupError.message}</Text>;
  }

  const handleTabChange = (value: string | null) => {
    if (value !== null) {
      setActiveTab(value);
    }
  };

  return (
    <>
      <SimpleGrid cols={1} p='xl' pb='0' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            User Group
          </Title>
          <Text fz='md' c='gray.10' w='50%'>
            View and manage the resources and members assigned to {userGroup.label}
          </Text>
        </Stack>

        <Tabs
          w='max-content'
          pt='md'
          value={activeTab}
          onTabChange={handleTabChange}
        >
          <Tabs.List>
            <Tabs.Tab value='members' pl='0'>
              Members
            </Tabs.Tab>
            <Tabs.Tab value='ai-providers'>AI Providers</Tabs.Tab>
            <Tabs.Tab value='kb-providers'>Knowledge Base Providers</Tabs.Tab>
            <Tabs.Tab value='ai-agents'>AI Agents</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </SimpleGrid>

      <Box mx='xl' pt='xl'>
        {activeTab === 'members' && <UserGroupMembersTable id={id} joinCode={userGroup.joinCode}/>}
        {activeTab === 'ai-providers' && <UserGroupAiProvidersTable id={id} />}
        {activeTab === 'kb-providers' && <UserGroupKbProvidersTable id={id} />}
        {activeTab === 'ai-agents' && <UserGroupAiAgentsTable id={id} />}
      </Box>
    </>
  );
}

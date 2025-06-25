import { Box, SimpleGrid, Title, Text, Tabs, Stack } from '@mantine/core';
import { UserRole } from '@/features/shared/types/user';
import { useSession } from 'next-auth/react';
import { useMemo } from 'react';
import { useSettings } from '@/providers/SettingsProvider';
import Loading from '@/features/shared/components/Loading';
import SystemConfigurations from '@/features/settings/components/system-configurations/SystemConfigurations';
import AiProviders from '@/features/settings/components/ai-providers/AiProviders';
import UserGroups from '@/features/settings/components/user-groups/UserGroups';
import Admins from '@/features/settings/components/admins/Admins';
import KbProviders from '@/features/settings/components/kb-providers/KbProviders';
import AiAgents from '@/features/settings/components/ai-agents/AiAgents';

export default function SettingsPage() {
  const { data: sessionData, status: sessionStatus } = useSession();

  const userIsAdmin = useMemo(() => {
    return sessionData?.user.role === UserRole.Admin;
  }, [sessionData?.user.role]);

  const { activeSettingsTab, setActiveSettingsTab } = useSettings();
  
  const settingsTabs = [
    { value: 'general', enabled: userIsAdmin },
    { value: 'ai-providers', enabled: userIsAdmin },
    { value: 'kb-providers', enabled: userIsAdmin },
    { value: 'admins', enabled: userIsAdmin },
    { value: 'user-groups', enabled: true },
    { value: 'ai-agents', enabled: userIsAdmin },
  ];

  const defaultActiveTab =
    settingsTabs.find((tab) => tab.enabled)?.value ?? null;
  const activeTab = activeSettingsTab ?? defaultActiveTab;

  if (sessionStatus === 'loading') {
    return <Loading />;
  }

  return (
    <>
      <SimpleGrid cols={1} p='xl' pb='0' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Settings
          </Title>
          <Text fz='md' c='gray.6'>
            Manage system settings and resources
          </Text>
        </Stack>

        <Tabs
          w='max-content'
          pt='md'
          value={activeTab}
          onTabChange={(value) => setActiveSettingsTab(value)}
        >
          <Tabs.List>
            {userIsAdmin && (
              <>
                <Tabs.Tab
                  value='general'
                  data-testid='settings-general-tab'
                >
                  General
                </Tabs.Tab>
                <Tabs.Tab
                  value='ai-providers'
                  data-testid='settings-ai-providers-tab'
                >
                  AI Providers
                </Tabs.Tab>
                <Tabs.Tab
                  value='kb-providers'
                  data-testid='settings-kb-providers-tab'
                >
                  Knowledge Base Providers
                </Tabs.Tab>
                <Tabs.Tab 
                  value='admins' 
                  data-testid='settings-admins-tab'
                >
                  Admins
                </Tabs.Tab>
                <Tabs.Tab 
                  value='ai-agents' 
                  data-testid='settings-ai-agents-tab'
                >
                  AI Agents
                </Tabs.Tab>
              </>
            )}

            <Tabs.Tab
              value='user-groups'
              data-testid='settings-user-groups-tab'
            >
              User Groups
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
      </SimpleGrid>

      <Box mx='xl' pt='xl'>
        {userIsAdmin && (
          <>
            {activeTab === 'general' && <SystemConfigurations />}
            {activeTab === 'ai-providers' && <AiProviders />}
            {activeTab === 'kb-providers' && <KbProviders />}
            {activeTab === 'admins' && <Admins />}
            {activeTab === 'ai-agents' && <AiAgents />}
          </>
        )}
        {activeTab === 'user-groups' && <UserGroups />}
      </Box>
    </>
  );
}

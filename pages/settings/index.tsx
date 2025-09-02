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
import DocumentUploadProviders from '@/features/settings/components/document-upload/DocumentUploadProviders';

export default function SettingsPage() {
  const { data: sessionData, status: sessionStatus } = useSession();

  const userIsAdmin = useMemo(() => {
    return sessionData?.user.role === UserRole.Admin;
  }, [sessionData?.user.role]);

  const { activeSettingsTab, setActiveSettingsTab } = useSettings();

  const settingsTabs = [
    { value: 'general', label: 'General', enabled: userIsAdmin },
    { value: 'ai-providers', label: 'AI Providers', enabled: userIsAdmin },
    { value: 'kb-providers', label: 'Knowledge Base Providers', enabled: userIsAdmin },
    { value: 'document-upload-providers', label: 'Document Upload Providers', enabled: userIsAdmin },
    { value: 'admins', label: 'Admins', enabled: userIsAdmin },
    { value: 'user-groups', label: 'User Groups', enabled: true },
    { value: 'ai-agents', label: 'AI Agents', enabled: userIsAdmin },
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
            {settingsTabs
              .filter((tab) => tab.enabled)
              .map((tab) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  data-testid={`settings-${tab.value}-tab`}
                >
                  {tab.label}
                </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </SimpleGrid>

      <Box mx='xl' pt='xl'>
        {userIsAdmin && (
          <>
            {activeTab === 'general' && <SystemConfigurations />}
            {activeTab === 'ai-providers' && <AiProviders />}
            {activeTab === 'kb-providers' && <KbProviders />}
            {activeTab === 'document-upload-providers' && <DocumentUploadProviders />}
            {activeTab === 'admins' && <Admins />}
            {activeTab === 'ai-agents' && <AiAgents />}
          </>
        )}
        {activeTab === 'user-groups' && <UserGroups />}
      </Box>
    </>
  );
}

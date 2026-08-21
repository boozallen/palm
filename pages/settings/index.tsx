import { Box, SimpleGrid, Title, Text, Tabs, Stack } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

import { UserRole } from '@/features/shared/types/user';
import SystemConfigurations from '@/features/settings/components/system-configurations/SystemConfigurations';
import AiProviders from '@/features/settings/components/ai-providers/AiProviders';
import UserGroups from '@/features/settings/components/user-groups/UserGroups';
import Admins from '@/features/settings/components/admins/Admins';
import KbProviders from '@/features/settings/components/kb-providers/KbProviders';
import AiAgents from '@/features/settings/components/ai-agents/AiAgents';
import DocumentUploadProviders from '@/features/settings/components/document-upload/DocumentUploadProviders';
import AgentProviders from '@/features/settings/components/agent-providers/AgentProviders';
import AgentServices from '@/features/settings/components/agent-services/AgentServices';
import GitHubProviders from '@/features/settings/components/github-providers/GitHubProviders';
import AdminDataSources from '@/features/settings/components/data-sources/AdminDataSources';
import Databases from '@/features/settings/components/databases/Databases';
import ArtifactTemplates from '@/features/settings/components/templates/ArtifactTemplates';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import useGetUserGroupsAsLead from '@/features/settings/api/user-groups/get-user-groups-as-lead';
import SettingsSidebarLayout from '@/features/settings/components/SettingsSidebarLayout';
import AuditRecords from '@/features/settings/components/audit-records/AuditRecords';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type TopLevelTab = 'system' | 'providers' | 'agents-services' | 'data-sources' | 'access-control';
type ProvidersSubTab = 'ai-providers' | 'kb-providers' | 'document-upload-providers' | 'agent-providers' | 'github-providers';
type AgentsServicesSubTab = 'ai-agents' | 'agent-services';
type DataSubTab = 'document-library' | 'databases' | 'templates';
type AccessControlSubTab = 'user-groups' | 'admins' | 'audit-records';

export default function SettingsPage() {
  const { data: sessionData, status: sessionStatus } = useSession();

  const userIsAdmin = useMemo(() => {
    return sessionData?.user.role === UserRole.Admin;
  }, [sessionData?.user.role]);

  const { data: leadGroupsData } = useGetUserGroupsAsLead();
  const userIsGroupLead = useMemo(() => {
    return (leadGroupsData?.userGroupsAsLead?.length ?? 0) > 0;
  }, [leadGroupsData?.userGroupsAsLead]);

  const track = useTrackClientEvent();

  const [activeTopLevelTab, setActiveTopLevelTab] = useState<TopLevelTab>('system');
  const [activeProvidersSubTab, setActiveProvidersSubTab] = useState<ProvidersSubTab>('ai-providers');
  const [activeAgentsServicesSubTab, setActiveAgentsServicesSubTab] = useState<AgentsServicesSubTab>('ai-agents');
  const [activeDataSubTab, setActiveDataSubTab] = useState<DataSubTab>('document-library');
  const [activeAccessControlSubTab, setActiveAccessControlSubTab] = useState<AccessControlSubTab>('user-groups');

  const topLevelTabs = [
    { value: 'system' as TopLevelTab, label: 'System', enabled: userIsAdmin },
    { value: 'providers' as TopLevelTab, label: 'Providers', enabled: userIsAdmin },
    { value: 'agents-services' as TopLevelTab, label: 'Agents & Services', enabled: userIsAdmin },
    { value: 'data-sources' as TopLevelTab, label: 'Data Sources', enabled: userIsAdmin },
    { value: 'access-control' as TopLevelTab, label: 'Access Control', enabled: true },
  ];

  const providersSubTabs = [
    { value: 'ai-providers' as ProvidersSubTab, label: 'AI Providers' },
    { value: 'kb-providers' as ProvidersSubTab, label: 'Knowledge Base Providers' },
    { value: 'document-upload-providers' as ProvidersSubTab, label: 'Document Upload Providers' },
    { value: 'agent-providers' as ProvidersSubTab, label: 'Agent Providers' },
    { value: 'github-providers' as ProvidersSubTab, label: 'GitHub Providers' },
  ];

  const agentsServicesSubTabs = [
    { value: 'ai-agents' as AgentsServicesSubTab, label: 'AI Agents' },
    { value: 'agent-services' as AgentsServicesSubTab, label: 'Agent Services' },
  ];

  const dataSubTabs = [
    { value: 'document-library' as DataSubTab, label: 'Document Library' },
    { value: 'templates' as DataSubTab, label: 'Artifact Templates', enabled: userIsAdmin },
    { value: 'databases' as DataSubTab, label: 'Databases', enabled: userIsAdmin },
  ].filter((tab) => tab.enabled !== false);

  const accessControlSubTabs = [
    { value: 'user-groups' as AccessControlSubTab, label: 'User Groups' },
    { value: 'admins' as AccessControlSubTab, label: 'Admins', enabled: userIsAdmin },
    { value: 'audit-records' as AccessControlSubTab, label: 'Audit Records', enabled: userIsAdmin },
  ].filter((tab) => tab.enabled !== false);

  const defaultActiveTab = topLevelTabs.find((tab) => tab.enabled)?.value ?? null;
  const currentTopLevelTab = activeTopLevelTab ?? defaultActiveTab;

  // Keep the URL hash in sync with the active tab. The client-side audit record
  // captures window.location.href as the referer, so without this the referer
  // would always be a bare /settings and lose which tab the user was on.
  const currentHash = useMemo(() => {
    switch (currentTopLevelTab) {
      case 'providers':
        return activeProvidersSubTab;
      case 'agents-services':
        return activeAgentsServicesSubTab;
      case 'data-sources':
        return activeDataSubTab;
      case 'access-control':
        return activeAccessControlSubTab;
      default:
        return currentTopLevelTab;
    }
  }, [
    currentTopLevelTab,
    activeProvidersSubTab,
    activeAgentsServicesSubTab,
    activeDataSubTab,
    activeAccessControlSubTab,
  ]);

  useEffect(() => {
    if (currentHash) {
      window.history.replaceState(null, '', `#${currentHash}`);
    }
  }, [currentHash]);

  if (sessionStatus === 'loading') {
    return <CenteredLoader />;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <SimpleGrid cols={1} p='md' pb='0' bg='dark.6'>
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
          value={currentTopLevelTab}
          onTabChange={(value) => {
            if (value) {
              const tab = topLevelTabs.find((t) => t.value === value);
              track.navigate(tab?.label ?? value, `/settings#${value}`);
              setActiveTopLevelTab(value as TopLevelTab);
            }
          }}
        >
          <Tabs.List>
            {topLevelTabs
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

      <Box p='md' sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {currentTopLevelTab === 'system' && userIsAdmin && <SystemConfigurations />}

        {currentTopLevelTab === 'providers' && userIsAdmin && (
          <SettingsSidebarLayout
            items={providersSubTabs}
            activeItem={activeProvidersSubTab}
            onItemChange={(value) => setActiveProvidersSubTab(value as ProvidersSubTab)}
          >
            {activeProvidersSubTab === 'ai-providers' && <AiProviders />}
            {activeProvidersSubTab === 'kb-providers' && <KbProviders />}
            {activeProvidersSubTab === 'document-upload-providers' && <DocumentUploadProviders />}
            {activeProvidersSubTab === 'agent-providers' && <AgentProviders />}
            {activeProvidersSubTab === 'github-providers' && <GitHubProviders />}
          </SettingsSidebarLayout>
        )}

        {currentTopLevelTab === 'agents-services' && userIsAdmin && (
          <SettingsSidebarLayout
            items={agentsServicesSubTabs}
            activeItem={activeAgentsServicesSubTab}
            onItemChange={(value) => setActiveAgentsServicesSubTab(value as AgentsServicesSubTab)}
          >
            {activeAgentsServicesSubTab === 'ai-agents' && <AiAgents />}
            {activeAgentsServicesSubTab === 'agent-services' && <AgentServices />}
          </SettingsSidebarLayout>
        )}

        {currentTopLevelTab === 'data-sources' && userIsAdmin && (
          <SettingsSidebarLayout
            items={dataSubTabs}
            activeItem={activeDataSubTab}
            onItemChange={(value) => setActiveDataSubTab(value as DataSubTab)}
          >
            {activeDataSubTab === 'document-library' && <AdminDataSources />}
            {activeDataSubTab === 'databases' && userIsAdmin && <Databases />}
            {activeDataSubTab === 'templates' && userIsAdmin && <ArtifactTemplates />}
          </SettingsSidebarLayout>
        )}

        {currentTopLevelTab === 'access-control' && (
          <SettingsSidebarLayout
            items={accessControlSubTabs}
            activeItem={activeAccessControlSubTab}
            onItemChange={(value) => setActiveAccessControlSubTab(value as AccessControlSubTab)}
          >
            {activeAccessControlSubTab === 'user-groups' && <UserGroups />}
            {activeAccessControlSubTab === 'admins' && userIsAdmin && <Admins />}
            {activeAccessControlSubTab === 'audit-records' && userIsAdmin && <AuditRecords />}
          </SettingsSidebarLayout>
        )}
      </Box>
    </Box>
  );
}

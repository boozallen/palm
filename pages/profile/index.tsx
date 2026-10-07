import { Box, SimpleGrid, Tabs, Title } from '@mantine/core';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';

import { useProfile } from '@/providers/ProfileProvider';
import { UserBanner } from '@/features/profile/components/UserBanner';
import UserGroups from '@/features/profile/components/user-groups/UserGroups';
import UserKnowledgeBases from '@/features/profile/components/kb-providers/UserKnowledgeBases';
import DocumentLibrary from '@/features/profile/components/document-library/DocumentLibrary';
import FirstLoginModal from '@/features/profile/components/modals/FirstLoginModal';
import General from '@/features/profile/components/general/General';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import { useJoinUserGroupCallout } from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

export default function DisplayProfile() {
  const router = useRouter();

  const { setActiveProfileTab, activeProfileTab } = useProfile();
  const { setBlockingModalOpen } = useJoinUserGroupCallout();
  const track = useTrackClientEvent();

  const {
    data: systemConfig,
    isPending: systemConfigIsPending,
  } = useGetSystemConfig();

  const {
    data: bedrockModelAccess,
    isPending: bedrockModelAccessIsLoading,
  } = useGetBedrockModelAccess();

  const documentLibraryEnabled = 
    systemConfig?.documentLibraryDocumentUploadProviderId && bedrockModelAccess?.hasAccess;

  const [defaultActiveTab, setDefaultActiveTab] = useState<string | null>(null);
  const [firstLoginModalOpen, setFirstLoginModalOpen] = useState(false);

  const profileTabs = useMemo(() => [
    {
      value: 'general',
      enabled: true,
      label: 'General',
      component: <General />,
    },
    {
      value: 'knowledge-bases',
      enabled: true,
      label: 'Knowledge Bases',
      component: <UserKnowledgeBases />,
    },
    {
      value: 'document-library',
      enabled: documentLibraryEnabled,
      label: 'Document Library',
      component: <DocumentLibrary />,
    },
    {
      value: 'user-groups',
      enabled: true,
      label: 'User Groups',
      component: <UserGroups />,
    },
  ], [documentLibraryEnabled]);

  useEffect(() => {
    const firstEnabled = profileTabs.find((tab) => tab.enabled)?.value ?? null;
    setDefaultActiveTab(firstEnabled);
  }, [documentLibraryEnabled, profileTabs]);

  useEffect(() => {
    if (router.query.first_login) {
      setFirstLoginModalOpen(true);
      setDefaultActiveTab('user-groups');
      const { first_login: _, ...restQuery } = router.query;
      router.replace(
        {
          pathname: router.pathname,
          query: restQuery,
        },
        undefined,
        { shallow: true }
      );
    }
  }, [router]);

  // Keep the floating dialog hidden while the first-login modal is open.
  useEffect(() => {
    setBlockingModalOpen(firstLoginModalOpen);
    return () => setBlockingModalOpen(false);
  }, [firstLoginModalOpen, setBlockingModalOpen]);

  const currentProfileTab = activeProfileTab ?? defaultActiveTab;

  // Keep the URL hash in sync with the active tab. The client-side audit record
  // captures window.location.href as the referer, so without this the referer
  // would always be a bare /profile and lose which tab the user was on.
  useEffect(() => {
    if (currentProfileTab) {
      window.history.replaceState(null, '', `#${currentProfileTab}`);
    }
  }, [currentProfileTab]);

  const handleTabChange = (value: string | null) => {
    if (value) {
      const tab = profileTabs.find((t) => t.value === value);
      track.navigate(tab?.label ?? value, `/profile#${value}`);
    }
    setActiveProfileTab(value);
  };

  if (systemConfigIsPending || bedrockModelAccessIsLoading) {
    return <CenteredLoader />;
  }

  return (
    <>
      <FirstLoginModal
        modalOpened={firstLoginModalOpen}
        closeModalHandler={() => setFirstLoginModalOpen(false)}
      />

      <SimpleGrid bg='dark.6' p='md' pb='0'>

        <Title fz='xxl' order={1} align='left' color='gray.1'>
          Profile
        </Title>
        <UserBanner />

      </SimpleGrid>

      {defaultActiveTab && (
        <Tabs
          value={currentProfileTab}
          onTabChange={handleTabChange}
        >
          <Box bg='dark.6' p='md' pb='0'>
            <Tabs.List bg='dark.6' w='max-content'>
              {profileTabs
                .filter((tab) => tab.enabled)
                .map((tab) => (
                  <Tabs.Tab
                    key={tab.value}
                    value={tab.value}
                    data-testid={`${tab.value}-tab`}
                  >
                    {tab.label}
                  </Tabs.Tab>
              ))}
            </Tabs.List>
          </Box>
          <Box mx='md'>
            {profileTabs
              .filter((tab) => tab.enabled)
              .map((tab) => (
                <Tabs.Panel
                  key={tab.value}
                  value={tab.value}
                  py='md'
                  style={{ border: 'none' }}
                >
                  {tab.component}
                </Tabs.Panel>
            ))}
          </Box>
        </Tabs>
      )}
    </>
  );
}

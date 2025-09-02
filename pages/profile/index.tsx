import { Box, SimpleGrid, Tabs, Title } from '@mantine/core';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

import { useProfile } from '@/providers/ProfileProvider';
import { UserBanner } from '@/features/profile/components/UserBanner';
import UserGroups from '@/features/profile/components/user-groups/UserGroups';
import UserKnowledgeBases from '@/features/profile/components/kb-providers/UserKnowledgeBases';
import DocumentLibrary from '@/features/profile/components/document-library/DocumentLibrary';
import FirstLoginModal from '@/features/profile/components/modals/FirstLoginModal';
import Loading from '@/features/shared/components/Loading';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

export default function DisplayProfile() {
  const router = useRouter();

  const { setActiveProfileTab, activeProfileTab } = useProfile();

  const {
    data: systemConfig,
    isPending: systemConfigIsPending,
  } = useGetSystemConfig();

  const documentLibraryEnabled = systemConfig?.documentLibraryDocumentUploadProviderId;

  // Initialize the active tab to null, set it after feature flags load
  const [defaultActiveTab, setDefaultActiveTab] = useState<string | null>(null);
  const [firstLoginModalOpen, setFirstLoginModalOpen] = useState(false);

  // Define list of all tabs in correct order and set which are enabled
  const profileTabs = [
    { value: 'knowledge-bases', enabled: true, label: 'Knowledge Bases' },
    { value: 'document-library', enabled: documentLibraryEnabled, label: 'Document Library' },
    { value: 'user-groups', enabled: true, label: 'User Groups' },
  ];

  useEffect(() => {
    const firstEnabled = profileTabs.find((tab) => tab.enabled)?.value ?? null;
    setDefaultActiveTab(firstEnabled);
  }, [documentLibraryEnabled]);

  useEffect(() => {
    if (router.query.first_login) {
      setFirstLoginModalOpen(true);
      setDefaultActiveTab('user-groups');
      const { first_login, ...restQuery } = router.query;
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

  if (systemConfigIsPending) {
    return <Loading />;
  }

  return (
    <>
      <FirstLoginModal
        modalOpened={firstLoginModalOpen}
        closeModalHandler={() => setFirstLoginModalOpen(false)}
      />

      <SimpleGrid bg='dark.6' p='xl' pb='0'>

        <Title fz='xxl' order={1} align='left' color='gray.1'>
          Profile
        </Title>
        <UserBanner />

      </SimpleGrid>
      {defaultActiveTab && (
        <Tabs
          value={activeProfileTab ?? defaultActiveTab}
          onTabChange={(value) => setActiveProfileTab(value)}
        >
          <Box bg='dark.6' p='xl' pb='0'>
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
          <Box mx='xl'>
            {profileTabs
              .filter((tab) => tab.enabled)
              .map((tab) => (
                <Tabs.Panel
                  key={tab.value}
                  value={tab.value}
                  py='xl'
                  style={{ border: 'none' }}
                >
                  {tab.value === 'knowledge-bases'
                    ? <UserKnowledgeBases />
                    : tab.value === 'document-library'
                    ? <DocumentLibrary />
                    : tab.value === 'user-groups'
                    ? <UserGroups />
                    : tab.value}
                </Tabs.Panel>
            ))}
          </Box>
        </Tabs>

      )}

    </>
  );
}

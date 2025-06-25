import { Box, SimpleGrid, Tabs, Title } from '@mantine/core';
import React, { useState, useEffect } from 'react';
import { useProfile } from '@/providers/ProfileProvider';
import { UserBanner } from '@/features/profile/components/UserBanner';
import { useGetFeatureFlag } from '@/features/shared/api/get-feature-flag';
import { features } from '@/libs/featureFlags';
import UserGroups from '@/features/profile/components/user-groups/UserGroups';
import UserKnowledgeBases from '@/features/profile/components/kb-providers/UserKnowledgeBases';
import DocumentLibrary from '@/features/profile/components/document-library/DocumentLibrary';
import FirstLoginModal from '@/features/profile/components/modals/FirstLoginModal';
import { useRouter } from 'next/router';

export default function DisplayProfile() {
  const router = useRouter();
  
  const { setActiveProfileTab, activeProfileTab } = useProfile();
  const { data: featureDocumentLibrary } = useGetFeatureFlag({
    feature: features.DOCUMENT_LIBRARY,
  });

  // Define list of all tabs in correct order and set which are enabled
  const profileTabs = [
    { value: 'knowledge-bases', enabled: true },
    { value: 'document-library', enabled: featureDocumentLibrary?.isFeatureOn ?? false },
    { value: 'user-groups', enabled: true },
  ];

  // Initialize the active tab to the first enabled tab (or null if no tabs are available)
  const [defaultActiveTab, setDefaultActiveTab] = useState(
    profileTabs.find((tab) => tab.enabled)?.value ?? null
  );

  const [firstLoginModalOpen, setFirstLoginModalOpen] = useState(false);

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
              <Tabs.Tab
                value='knowledge-bases'
                data-testid='knowledge-bases-tab'
              >
                Knowledge Bases
              </Tabs.Tab>
              {featureDocumentLibrary?.isFeatureOn && (
                <Tabs.Tab
                  value='document-library'
                  data-testid='document-library-tab'
                >
                  Document Library
                </Tabs.Tab>
              )}
              <Tabs.Tab
                value='user-groups'
                data-testid='user-groups-tab'
              >
                User Groups
              </Tabs.Tab>
            </Tabs.List>
          </Box>
          <Box mx='xl'>
            <Tabs.Panel
              value='knowledge-bases'
              py='xl'
              style={{ border: 'none' }}
            >
              <UserKnowledgeBases />
            </Tabs.Panel>
            
            {featureDocumentLibrary?.isFeatureOn && (
              <Tabs.Panel
                value='document-library'
                py='xl'
                style={{ border: 'none' }}
              >
                <DocumentLibrary />
              </Tabs.Panel>
            )}

            <Tabs.Panel value='user-groups' py='xl' style={{ border: 'none' }}>
              <UserGroups />
            </Tabs.Panel>
          </Box>
        </Tabs>

      )}

    </>
  );
}

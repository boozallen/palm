import { ActionIcon, Box, Group, Stack, Title, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus, IconFolders } from '@tabler/icons-react';

import AddSourcesModal from '@/features/shared/components/modals/AddSourcesModal';
import ManageCollectionsModal from '@/features/shared/components/document-library/modals/ManageCollectionsModal';
import DocumentLibraryTable from './tables/DocumentLibraryTable';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';

export default function DocumentLibrary() {
  const [
    addDocumentModalOpened,
    { open: openAddDocumentModal, close: closeAddDocumentModal },
  ] = useDisclosure();

  const [
    manageCollectionsModalOpened,
    { open: openManageCollectionsModal, close: closeManageCollectionsModal },
  ] = useDisclosure();

  const { data: documentUploadRequirements, isPending: documentUploadRequirementsLoading } = useGetDocumentUploadRequirements();
  const { data: systemConfig } = useGetSystemConfig();
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';

  const { data: userDocuments } = useGetDocuments({
    documentUploadProviderId,
  });

  const hasRequirements = documentUploadRequirements?.configured ?? false;
  const documentSourceCount = userDocuments?.documents?.length ?? 0;

  return (
    <>
      <AddSourcesModal
        isModalOpen={addDocumentModalOpened}
        closeModalHandler={closeAddDocumentModal}
        documentSourceCount={documentSourceCount}
      />

      <ManageCollectionsModal
        modalOpened={manageCollectionsModalOpened}
        closeModalHandler={closeManageCollectionsModal}
      />

      <Stack spacing='md' p='md' bg='dark.6'>
        <Group spacing='sm'>
          <Title weight='bold' color='gray.6' order={2}>
            My Uploaded Documents
          </Title>

          <Box>
            <Tooltip
              label={'Document Library requires configuration. Please contact your administrator.'}
              disabled={hasRequirements || documentUploadRequirementsLoading}
              withArrow
              // Explicitly set events to prevent tooltip from showing whenever disabled prop changes value
              events={{ 'hover': true, 'focus': true, 'touch': true }}
            >
              <Box>
                <ActionIcon
                  variant='system_management'
                  data-testid='add-document-button'
                  onClick={openAddDocumentModal}
                  disabled={!hasRequirements}
                  aria-label='Upload documents'
                >
                  <IconCirclePlus />
                </ActionIcon>
              </Box>
            </Tooltip>
          </Box>

          <Tooltip label='Manage collections' withArrow>
            <ActionIcon
              variant='system_management'
              onClick={openManageCollectionsModal}
              aria-label='Manage collections'
            >
              <IconFolders />
            </ActionIcon>
          </Tooltip>
        </Group>
        <DocumentLibraryTable />
      </Stack>
    </>
  );
}

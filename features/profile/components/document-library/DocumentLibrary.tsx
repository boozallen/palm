import { ActionIcon, Box, Group, Stack, Title, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AddDocumentModal from './modals/AddDocumentModal';
import DocumentLibraryTable from './tables/DocumentLibraryTable';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';

export default function DocumentLibrary() {
  const [
    addDocumentModalOpened,
    { open: openAddDocumentModal, close: closeAddDocumentModal },
  ] = useDisclosure();

  const { data: documentUploadRequirements, isPending: documentUploadRequirementsLoading } = useGetDocumentUploadRequirements();

  const hasRequirements = documentUploadRequirements?.configured ?? false;

  return (
    <>
      <AddDocumentModal
        isModalOpen={addDocumentModalOpened}
        closeModalHandler={closeAddDocumentModal}
      />

      <Stack spacing='md' p='xl' bg='dark.6'>
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
        </Group>
        <DocumentLibraryTable />
      </Stack>
    </>
  );
}

import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AddDocumentModal from './modals/AddDocumentModal';
import UserDocumentLibraryTable from './tables/UserDocumentLibraryTable';

export default function DocumentLibrary() {

  const [
    addDocumentModalOpened,
    { open: openAddDocumentModal, close: closeAddDocumentModal },
  ] = useDisclosure();

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
          <ActionIcon
            variant='system_management'
            data-testid='add-document-button'
            onClick={openAddDocumentModal}
            aria-label='Upload documents'
          >
            <IconCirclePlus />
          </ActionIcon>
        </Group>
        <UserDocumentLibraryTable />
      </Stack>
    </>
  );
}

import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AddDocumentUploadProviderModal from './modals/AddDocumentUploadProviderModal';
import DocumentUploadProvidersTable from './tables/DocumentUploadProvidersTable';

export default function DocumentUploadProviders() {
  const [
    addDocumentUploadProviderModalIsOpened,
    { open: openAddDocumentUploadProviderModal, close: closeAddDocumentUploadProviderModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddDocumentUploadProviderModal
        opened={addDocumentUploadProviderModalIsOpened}
        handleCloseModal={closeAddDocumentUploadProviderModal}
      />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Document Upload Providers
        </Title>
        <ActionIcon
          variant='system_management'
          onClick={openAddDocumentUploadProviderModal}
          aria-label='Add document upload provider'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <DocumentUploadProvidersTable />
    </Stack>
  );
}

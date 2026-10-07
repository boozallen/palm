import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import ArtifactTemplatesTable from './tables/ArtifactTemplatesTable';
import UploadTemplateModal from './modals/UploadTemplateModal';

export default function ArtifactTemplates() {
  const [
    uploadModalOpened,
    { open: openUploadModal, close: closeUploadModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <UploadTemplateModal
        modalOpened={uploadModalOpened}
        closeModalHandler={closeUploadModal}
      />
      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2} data-testid='artifact-templates-title'>
          Artifact Templates
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='upload-template-button'
          onClick={openUploadModal}
          aria-label='Upload template'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <ArtifactTemplatesTable />
    </Stack>
  );
}

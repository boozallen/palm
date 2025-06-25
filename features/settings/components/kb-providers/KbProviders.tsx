import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import KbProvidersTable from './tables/KbProvidersTable';
import AddKbProviderModal from '@/features/settings/components/kb-providers/modals/AddKbProviderModal';

export default function KbProviders() {

  const [
    addKbProviderModalOpened,
    { open: openAddKbProviderModal, close: closeAddKbProviderModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddKbProviderModal
        modalOpen={addKbProviderModalOpened}
        closeModalHandler={closeAddKbProviderModal}
      />
      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Knowledge Base Providers
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='add-kb-provider-button'
          onClick={openAddKbProviderModal}
          aria-label='Add knowledge base provider'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <KbProvidersTable />
    </Stack>
  );
}

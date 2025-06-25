import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';
import AiProvidersTable from './tables/AiProvidersTable';
import AddAiProviderModal from './modals/AddAiProviderModal';

export default function AiProviders() {

  const [
    addAiProviderModalOpened,
    { open: openAddAiProviderModal, close: closeAddAiProviderModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddAiProviderModal
        modalOpen={addAiProviderModalOpened}
        closeModalHandler={closeAddAiProviderModal}
      />
      
      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          AI Providers
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='add-provider-button'
          onClick={openAddAiProviderModal}
          aria-label='Add ai provider'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <AiProvidersTable />
    </Stack>
  );
}

import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';
import AgentProvidersTable from './tables/AgentProvidersTable';
import AddAgentProviderModal from './modals/AddAgentProviderModal';

export default function AgentProviders() {
  const [addModalOpened, { open: openAddModal, close: closeAddModal }] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddAgentProviderModal modalOpen={addModalOpened} closeModalHandler={closeAddModal} />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Agent Providers
        </Title>
        <ActionIcon
          variant='system_management'
          data-testid='add-agent-provider-button'
          onClick={openAddModal}
          aria-label='Add agent provider'
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <AgentProvidersTable />
    </Stack>
  );
}

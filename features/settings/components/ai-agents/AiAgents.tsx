import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AiAgentsTable from './tables/AiAgentsTable';
import AddAgentModal from './modals/AddAgentModal';

export default function AiAgents() {
  const [
    addAiAgentModalOpened,
    { open: openAddAiAgentModal, close: closeAddAiAgentModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddAgentModal
        modalOpen={addAiAgentModalOpened}
        closeModalHandler={closeAddAiAgentModal}
      />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          AI Agents
        </Title>
        <ActionIcon
          variant='system_management'
          aria-label='Add AI agent'
          onClick={openAddAiAgentModal}
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <AiAgentsTable />
    </Stack>
  );
}

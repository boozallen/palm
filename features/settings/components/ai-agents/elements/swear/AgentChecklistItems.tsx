import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { IconCirclePlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import ChecklistItemTable from '../../tables/swear/ChecklistItemTable';
import AddChecklistItemModal from '../../modals/swear/AddChecklistItemModal';

type AgentChecklistItemsProps = Readonly<{
  aiAgentId: string;
}>;

export default function AgentChecklistItems({
  aiAgentId,
}: AgentChecklistItemsProps) {
  const [
    addChecklistItemModalOpened,
    { open: openAddChecklistItemModal, close: closeAddChecklistItemModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddChecklistItemModal
        isOpened={addChecklistItemModalOpened}
        closeModal={closeAddChecklistItemModal}
        aiAgentId={aiAgentId}
      />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Checklist Items
        </Title>

        <ActionIcon
          variant='system_management'
          aria-label='Add New Checklist Item'
          onClick={openAddChecklistItemModal}
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <ChecklistItemTable aiAgentId={aiAgentId} />
    </Stack>
  );
}

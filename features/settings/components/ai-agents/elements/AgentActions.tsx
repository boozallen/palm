import { ActionIcon, Box, Group } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPencil, IconTrash } from '@tabler/icons-react';

import { AiAgentType } from '@/features/shared/types';
import EditAgentModal from '@/features/settings/components/ai-agents/modals/EditAgentModal';
import DeleteAgentModal from '@/features/settings/components/ai-agents/modals/DeleteAgentModal';

export type AgentActionsProps = Readonly<{
  id: string;
  label: string;
  description: string;
  type: AiAgentType;
}>;

export default function AgentActions({
  id,
  label,
  description,
  type,
}: AgentActionsProps) {

  const agent = { id, label, description, type };

  const [
    editAgentModelOpened,
    { open: openEditAgentModal, close: closeEditAgentModal },
  ] = useDisclosure(false);

  const [
    deleteAgentModelOpened,
    { open: openDeleteAgentModal, close: closeDeleteAgentModal },
  ] = useDisclosure(false);

  return (
    <Box>
      <EditAgentModal
        modalOpened={editAgentModelOpened}
        closeModalHandler={closeEditAgentModal}
        agent={agent}
      />

      <DeleteAgentModal
        modalOpen={deleteAgentModelOpened}
        closeModalHandler={closeDeleteAgentModal}
        agentId={agent.id}
      />

      <Group>
        <ActionIcon
          onClick={openEditAgentModal}
          aria-label={`Edit ${agent.label} Agent`}
        >
          <IconPencil />
        </ActionIcon>
        <ActionIcon
          onClick={openDeleteAgentModal}
          aria-label={`Delete ${agent.label} Agent`}
        >
          <IconTrash />
        </ActionIcon>
      </Group>
    </Box>
  );
}

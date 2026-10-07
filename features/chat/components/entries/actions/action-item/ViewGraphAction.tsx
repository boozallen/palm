import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTopologyRing } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';

type ViewGraphActionProps = {
  messageId: string;
};

/**
 * Jump from a chat answer to its evidence graph: restores this answer's subgraph as the active,
 * interactive graph and opens the graph pane (the chat → graph half of the history linking). Sits
 * in the answer's provenance row next to the document citations, always visible.
 */
export default function ViewGraphAction({ messageId }: ViewGraphActionProps) {
  const { restoreEvidence } = useChat();

  return (
    <Tooltip label="View this answer's graph" position='bottom' withArrow>
      <ActionIcon
        onClick={() => restoreEvidence(messageId)}
        aria-label='View graph'
        radius='xl'
        size='sm'
        variant='light'
        color='cyan'
      >
        <IconTopologyRing size={16} stroke={1.5} />
      </ActionIcon>
    </Tooltip>
  );
}

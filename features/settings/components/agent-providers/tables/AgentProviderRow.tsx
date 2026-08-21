import { Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { AgentProviderActionsMenu } from '@/features/settings/components/agent-providers/menus/AgentProviderActionsMenu';
import EditAgentProviderModal from '@/features/settings/components/agent-providers/modals/EditAgentProviderModal';
import DeleteAgentProviderModal from '@/features/settings/components/agent-providers/modals/DeleteAgentProviderModal';

type AgentProvider = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type AgentProviderRowProps = {
  provider: AgentProvider;
};

export default function AgentProviderRow({ provider }: Readonly<AgentProviderRowProps>) {
  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  return (
    <>
      <EditAgentProviderModal
        agentProvider={provider}
        modalOpen={editOpened}
        closeModalHandler={closeEdit}
      />
      <DeleteAgentProviderModal
        agentProvider={provider}
        modalOpen={deleteOpened}
        closeModalHandler={closeDelete}
      />
      <tr>
        <td>
          <Text fw={500}>{provider.name}</Text>
        </td>
        <td>
          <Text c='dimmed' fz='sm'>{provider.description || '—'}</Text>
        </td>
        <td>
          <Text fz='sm' style={{ wordBreak: 'break-all' }}>{provider.endpoint}</Text>
        </td>
        <td>
          <Group position='right'>
            <AgentProviderActionsMenu
              agentProviderId={provider.id}
              agentProviderName={provider.name}
              onEditClick={openEdit}
              onDeleteClick={openDelete}
            />
          </Group>
        </td>
      </tr>
    </>
  );
}

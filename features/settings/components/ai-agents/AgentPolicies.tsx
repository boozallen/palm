import { ActionIcon, Group, Stack, Title } from '@mantine/core';
import { IconCirclePlus } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import AgentPolicyTable from './tables/AgentPolicyTable';
import AddPolicyModal from './modals/AddPolicyModal';

type AgentPoliciesProps = Readonly<{
  aiAgentId: string;
}>

export default function AgentPolicies({
  aiAgentId,
}: AgentPoliciesProps) {

  const [
    addPolicyModalOpened,
    { open: openAddPolicyModal, close: closeAddPolicyModal },
  ] = useDisclosure(false);

  return (
    <Stack spacing='md'>
      <AddPolicyModal
        isOpened={addPolicyModalOpened}
        closeModal={closeAddPolicyModal}
        aiAgentId={aiAgentId}
      />

      <Group spacing='sm'>
        <Title weight='bold' color='gray.6' order={2}>
          Policies
        </Title>

        <ActionIcon
          variant='system_management'
          aria-label='Add New Policy'
          onClick={openAddPolicyModal}
        >
          <IconCirclePlus />
        </ActionIcon>
      </Group>

      <AgentPolicyTable aiAgentId={aiAgentId}/>
    </Stack>
  );
}

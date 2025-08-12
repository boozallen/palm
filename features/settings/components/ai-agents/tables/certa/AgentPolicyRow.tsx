import { useDisclosure } from '@mantine/hooks';
import { ActionIcon, Group, Spoiler } from '@mantine/core';
import { IconPencil, IconTrash } from '@tabler/icons-react';

import { PolicyForm } from '@/features/settings/types';
import DeletePolicyModal from '@/features/settings/components/ai-agents/modals/certa/DeletePolicyModal';
import { AgentPolicy } from '@/features/shared/types';
import EditPolicyModal from '@/features/settings/components/ai-agents/modals/certa/EditPolicyModal';

type AgentPolicyRowProps = Readonly<{
  policy: AgentPolicy;
}>;

export default function AgentPolicyRow({ policy }: AgentPolicyRowProps) {
  const [
    editPolicyModalOpened,
    { open: openEditPolicyModal, close: closeEditPolicyModal },
  ] = useDisclosure(false);

  const [
    deletePolicyModalOpened,
    { open: openDeletePolicyModal, close: closeDeletePolicyModal },
  ] = useDisclosure(false);

  const policyFormValues: PolicyForm = {
    title: policy.title,
    content: policy.content,
    requirements: policy.requirements,
  };

  return (
    <>
      <EditPolicyModal
        isOpened={editPolicyModalOpened}
        closeModal={closeEditPolicyModal}
        policyId={policy.id}
        initialValues={policyFormValues}
      />
      <DeletePolicyModal
        policyId={policy.id}
        modalOpened={deletePolicyModalOpened}
        closeModalHandler={closeDeletePolicyModal}
      />

      <tr>
        <td>{policy.title}</td>
        <td>
          <Spoiler maxHeight={50} showLabel='Show more' hideLabel='Show less'>
            {policy.content}
          </Spoiler>
        </td>
        <td>
          <Spoiler maxHeight={50} showLabel='Show more' hideLabel='Show less'>
            {policy.requirements}
          </Spoiler>
        </td>
        <td>
          <Group spacing='xs' noWrap>
            <ActionIcon
              aria-label={`Edit ${policy.title} Policy`}
              onClick={openEditPolicyModal}
            >
              <IconPencil />
            </ActionIcon>
            <ActionIcon
              aria-label={`Delete ${policy.title} Policy`}
              onClick={openDeletePolicyModal}
            >
              <IconTrash />
            </ActionIcon>
          </Group>
        </td>
      </tr>
    </>
  );
}

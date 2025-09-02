import useUpdateUserPreselectedKnowledgeBases from '@/features/profile/api/update-user-preselected-knowledge-bases';
import { Checkbox } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

type UserKnowledgeBase = {
  id: string;
  label: string
}
type UserKnowledgeBaseRowProps = Readonly<{
  knowledgeBase: UserKnowledgeBase;
  checked: boolean;
}>

export default function UserKnowledgeBaseRow({
  knowledgeBase,
  checked,
}: UserKnowledgeBaseRowProps) {

  const {
    mutateAsync: updateUserPreselectedKnowledgeBases,
    error: updateUserPreselectedKnowledgeBasesError,
  } = useUpdateUserPreselectedKnowledgeBases();

  const togglePreselectedKnowledgeBase = async (preselected: boolean) => {

    try {
      await updateUserPreselectedKnowledgeBases({
        knowledgeBaseId: knowledgeBase.id,
        preselected,
      });
    } catch (error) {
      const message = updateUserPreselectedKnowledgeBasesError?.message ??
        'Failed to update knowledge base selections';

      notifications.show({
        id: 'update-preselected-knowledge-base-failed',
        title: 'Failed to Update',
        message: message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }

  };
  return (
    <tr className='provider-model-row'>
      <td></td>
      <td>{knowledgeBase.label}</td>
      <td>
        <Checkbox
          aria-label={`Enable ${knowledgeBase.label}`}
          checked={checked}
          onChange={(event) =>
            togglePreselectedKnowledgeBase(event.currentTarget.checked)
          }
        />
      </td>
    </tr>
  );
}

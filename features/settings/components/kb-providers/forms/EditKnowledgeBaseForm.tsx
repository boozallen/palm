import useUpdateKnowledgeBase from '@/features/settings/api/update-knowledge-base';
import {
  KnowledgeBaseForm,
  knowledgeBaseFormSchema,
} from '@/features/shared/types';
import { ActionIcon, Group, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { Dispatch, SetStateAction } from 'react';

type EditKnowledgeBaseFormProps = Readonly<{
  id: string;
  label: string;
  externalId: string;
  setEditKnowledgeBase: Dispatch<SetStateAction<boolean>>;
}>;

export default function EditKnowledgeBaseForm({
  id,
  label,
  externalId,
  setEditKnowledgeBase,
}: EditKnowledgeBaseFormProps) {
  const {
    mutateAsync: updateKnowledgeBase,
    isPending: updateKnowledgeBaseIsPending,
    error: updateKnowledgeBaseError,
  } = useUpdateKnowledgeBase();

  const editKnowledgeBaseForm = useForm<KnowledgeBaseForm>({
    initialValues: {
      label,
      externalId,
    },
    validate: zodResolver(knowledgeBaseFormSchema),
  });

  const handleSubmit = async (values: KnowledgeBaseForm) => {
    try {
      if (editKnowledgeBaseForm.isDirty()) {
        await updateKnowledgeBase({
          id,
          ...values,
        });
      }

      handleClose();
    } catch (error) {
      notifications.show({
        id: 'edit-knowledge-base-failed',
        title: 'Failed to Save Changes',
        message:
          updateKnowledgeBaseError?.message ||
          'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    setEditKnowledgeBase(false);
    editKnowledgeBaseForm.reset();
  };

  return (
    <form onSubmit={editKnowledgeBaseForm.onSubmit(handleSubmit)}>
      <Group position='center'>
        <TextInput
          variant='default'
          label='Label'
          {...editKnowledgeBaseForm.getInputProps('label')}
        />
        <TextInput
          variant='default'
          label='External ID'
          {...editKnowledgeBaseForm.getInputProps('externalId')}
        />
        <ActionIcon type='submit' loading={updateKnowledgeBaseIsPending} aria-label='Confirm'>
          <IconCheck />
        </ActionIcon>
        <ActionIcon onClick={handleClose} aria-label='Cancel'>
          <IconX />
        </ActionIcon>
      </Group>
    </form>
  );
}

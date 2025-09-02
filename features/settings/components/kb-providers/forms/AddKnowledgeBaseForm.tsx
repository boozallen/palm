import useCreateKnowledgeBase from '@/features/settings/api/kb-providers/create-knowledge-base';
import { KnowledgeBaseForm, knowledgeBaseFormSchema } from '@/features/shared/types';
import { ActionIcon, Group, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { DisplayKnowledgeBaseRow } from '@/features/settings/components/kb-providers/tables/KbProvidersTable';
import { Dispatch, SetStateAction } from 'react';

type AddKnowledgeBaseFormProps = Readonly<{
  kbProviderId: string;
  setShowAddKnowledgeBaseRow: Dispatch<SetStateAction<DisplayKnowledgeBaseRow>>;
}>;

export default function AddKnowledgeBaseForm({
  kbProviderId,
  setShowAddKnowledgeBaseRow,
}: AddKnowledgeBaseFormProps) {
  const {
    mutateAsync: addKnowledgeBase,
    isPending: addKnowledgeBaselIsPending,
    error: addKnowledgeBaseError,
  } = useCreateKnowledgeBase();

  const addKnowledgeBaseForm = useForm<KnowledgeBaseForm>({
    initialValues: {
      label: '',
      externalId: '',
    },
    validate: zodResolver(knowledgeBaseFormSchema),
  });

  const handleSubmit = async (values: KnowledgeBaseForm) => {
    try {
      await addKnowledgeBase({
        ...values,
        kbProviderId: kbProviderId,
      });

      handleClose();
    } catch (error) {
      notifications.show({
        id: 'add-knowledge-base-failed',
        title: 'Failed to Create Knowledge Base',
        message:
          addKnowledgeBaseError?.message ??
          'Unable to create knowledge base. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    setShowAddKnowledgeBaseRow({ isVisible: false, kbProviderId: '' });
    addKnowledgeBaseForm.reset();
  };

  return (
    <form onSubmit={addKnowledgeBaseForm.onSubmit(handleSubmit)}>
      <Group position='center'>
        <TextInput
          variant='default'
          label='Label'
          placeholder='Add label'
          {...addKnowledgeBaseForm.getInputProps('label')}
        />
        <TextInput
          variant='default'
          label='External ID'
          placeholder='Add external ID'
          {...addKnowledgeBaseForm.getInputProps('externalId')}
        />
        <ActionIcon type='submit' loading={addKnowledgeBaselIsPending}>
          <IconCheck />
        </ActionIcon>
        <ActionIcon onClick={handleClose}>
          <IconX />
        </ActionIcon>
      </Group>
    </form>
  );
}

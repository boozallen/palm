import { Button, Group, Modal, TextInput, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { z } from 'zod';

import { useUpdateWorkflow } from '@/features/workflows/api/update-workflow';

const editWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string(),
});

type EditWorkflowFormValues = z.infer<typeof editWorkflowSchema>;

type EditWorkflowModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  workflow: {
    id: string;
    name: string;
    description: string;
  };
  onEditSuccess?: () => void;
}>;

export default function EditWorkflowModal({
  modalOpened,
  closeModalHandler,
  workflow,
  onEditSuccess,
}: EditWorkflowModalProps) {
  const {
    mutateAsync: updateWorkflow,
    isPending,
    error: updateError,
  } = useUpdateWorkflow();

  const form = useForm<EditWorkflowFormValues>({
    initialValues: {
      name: workflow.name,
      description: workflow.description,
    },
    validate: zodResolver(editWorkflowSchema),
  });

  const handleSubmit = async (values: EditWorkflowFormValues) => {
    try {
      if (form.isDirty()) {
        await updateWorkflow({
          workflowId: workflow.id,
          name: values.name.trim(),
          description: values.description.trim(),
        });
      }

      form.reset();
      closeModalHandler();
      if (onEditSuccess) {
        onEditSuccess();
      }
    } catch (error) {
      notifications.show({
        id: 'edit-workflow-failed',
        title: 'Failed to Update Workflow',
        message:
          updateError?.message ||
          'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleClose = () => {
    form.reset();
    closeModalHandler();
  };

  return (
    <Modal
      title='Edit Workflow'
      opened={modalOpened}
      onClose={handleClose}
      withCloseButton={false}
      closeOnClickOutside={false}
      centered
      data-testid='edit-workflow-modal'
      size='lg'
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput
          label='Name'
          placeholder='Workflow name'
          {...form.getInputProps('name')}
        />
        <Textarea
          label='Description'
          autosize
          minRows={3}
          placeholder='Describe the workflow'
          {...form.getInputProps('description')}
        />
        <Group spacing='lg' grow mt='md'>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type='submit'
            disabled={!form.isValid() || !form.isDirty() || isPending}
            loading={isPending}
          >
            {isPending ? 'Saving Changes' : 'Save Changes'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

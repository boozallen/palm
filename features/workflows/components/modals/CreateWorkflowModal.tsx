import { Button, Group, Modal, TextInput, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { z } from 'zod';

import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { validateWorkflowGraph, graphToWorkflow } from '@/features/workflows/utils/workflow-conversion';
import { useCreateWorkflow } from '@/features/workflows/hooks/useCreateWorkflow';

const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string(),
});

type CreateWorkflowFormValues = z.infer<typeof createWorkflowSchema>;

interface CreateWorkflowModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess?: (workflowId: string, workflowName: string) => void;
}

export default function CreateWorkflowModal({
  opened,
  onClose,
  onSuccess,
}: Readonly<CreateWorkflowModalProps>) {
  const { nodes, edges, viewport, pinnedGroup } = useWorkflowBuilder();
  const createWorkflow = useCreateWorkflow();

  const form = useForm<CreateWorkflowFormValues>({
    initialValues: {
      name: '',
      description: '',
    },
    validate: zodResolver(createWorkflowSchema),
  });

  const handleSubmit = async (values: CreateWorkflowFormValues) => {
    const validation = validateWorkflowGraph(nodes, edges);
    if (!validation.valid) {
      notifications.show({
        title: 'Workflow Validation Failed',
        message: validation.errors.join(', '),
        color: 'red',
        icon: <IconX />,
      });
      return;
    }

    try {
      const primitives = graphToWorkflow(nodes, edges);

      const result = await createWorkflow.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        primitives,
        viewport,
        pinnedUserGroupId: pinnedGroup?.id,
      });

      form.reset();

      if (onSuccess && result?.id) {
        onSuccess(result.id, values.name);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to create workflow',
        color: 'red',
        icon: <IconX />,
      });
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      title='Create Workflow'
      opened={opened}
      onClose={handleClose}
      withCloseButton={false}
      closeOnClickOutside={false}
      centered
      data-testid='create-workflow-modal'
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
        <Group spacing='lg' grow>
          <Button variant='outline' onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type='submit'
            disabled={!form.isValid() || nodes.length === 0 || createWorkflow.isPending}
            loading={createWorkflow.isPending}
          >
            {createWorkflow.isPending ? 'Creating Workflow' : 'Create Workflow'}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

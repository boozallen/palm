import { Button, Group, Select, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import {
  agentForm,
  AgentForm,
  AiAgentSelectInputOptions,
} from '@/features/settings/types';
import { AiAgent } from '@/features/shared/types';
import useUpdateAiAgent from '@/features/settings/api/ai-agents/update-ai-agent';

type EditAgentFormProps = Readonly<{
  agent: AiAgent;
  setFormCompleted: (completed: boolean) => void;
}>;

export default function EditAgentForm({
  agent,
  setFormCompleted,
}: EditAgentFormProps) {
  const {
    mutateAsync: updateAiAgent,
    isPending: updateAiAgentIsPending,
    error: updateAiAgentError,
  } = useUpdateAiAgent();

  const form = useForm<AgentForm>({
    initialValues: {
      label: agent.label,
      description: agent.description,
      type: agent.type,
    },
    validate: zodResolver(agentForm),
  });

  function handleFormCompletion() {
    setFormCompleted(true);
  }

  const handleSubmit = async (values: AgentForm) => {
    try {
      if (form.isDirty()) {
        await updateAiAgent({
          id: agent.id,
          label: values.label,
          description: values.description,
          type: values.type,
        });
      }

      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'edit-ai-agent-failed',
        title: 'Failed to Save Changes',
        message:
          updateAiAgentError?.message ||
          'Unable to save your changes. Please try again later.',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Select
        label='Agent'
        placeholder='Select agent type'
        data={AiAgentSelectInputOptions}
        value={form.values.type.toString()}
        disabled
      />
      <TextInput
        label='Name'
        placeholder='Name the agent'
        {...form.getInputProps('label')}
      />
      <Textarea
        label='Description'
        autosize
        minRows={3}
        placeholder="Describe the agent's purpose"
        {...form.getInputProps('description')}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={
            !form.isValid() || !form.isDirty() || updateAiAgentIsPending
          }
          loading={updateAiAgentIsPending}
        >
          {updateAiAgentIsPending ? 'Updating Agent' : 'Update Agent'}
        </Button>
      </Group>
    </form>
  );
}

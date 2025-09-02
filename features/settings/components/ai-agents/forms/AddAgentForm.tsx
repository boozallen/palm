import { Button, Group, Select, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { TRPCClientError } from '@trpc/client';
import { Dispatch, SetStateAction } from 'react';

import { agentForm, AgentForm, AiAgentSelectInputOptions } from '@/features/settings/types';
import useCreateAiAgent from '@/features/settings/api/ai-agents/create-ai-agent';
import { AiAgentType } from '@/features/shared/types';

type AddAgentFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddAgentForm({ setFormCompleted }: AddAgentFormProps) {
  const {
    mutateAsync: createAiAgent,
    isPending: createAiAgentIsLoading,
  } = useCreateAiAgent();

  const form = useForm<AgentForm>({
    initialValues: {
      label: '',
      description: '',
      type: 0,
    },
    validate: zodResolver(agentForm),
  });

  function handleFormCompletion() {
    setFormCompleted(true);
  }

  const handleSubmit = async (values: AgentForm) => {
    try {
      await createAiAgent({
        label: values.label,
        description: values.description,
        type: Number(values.type) as AiAgentType,
      });

      handleFormCompletion();
    } catch (error) {
      let errorMessage = 'An unexpected error occurred while creating the AI agent. Please try again later.';

      if (error instanceof Error || error instanceof TRPCClientError) {
        errorMessage = error.message;
      }

      notifications.show({
        id: 'create-ai-agent-error',
        title: 'Error Creating AI Agent',
        message: errorMessage,
        autoClose: true,
        icon: <IconX />,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Select
        label='Agent'
        placeholder='Select agent type'
        data={AiAgentSelectInputOptions}
        {...form.getInputProps('type')}
      />
      <TextInput
        label='Name'
        placeholder='Name the agent'
        {...form.getInputProps('label')}
      />
      <Textarea
        label='Description'
        minRows={3}
        autosize
        placeholder="Describe the agent's purpose"
        {...form.getInputProps('description')}
      />
      <Group spacing='lg' grow>
        <Button
          variant='outline'
          onClick={handleFormCompletion}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          loading={createAiAgentIsLoading}
        >
          {!createAiAgentIsLoading ? 'Add Agent' : 'Adding Agent'}
        </Button>
      </Group>
    </form>
  );
}

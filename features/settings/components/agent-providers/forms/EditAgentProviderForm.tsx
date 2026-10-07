import { z } from 'zod';
import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import useUpdateAgentProvider from '@/features/settings/api/agent-providers/update-agent-provider';

type AgentProvider = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
};

type EditAgentProviderFormProps = {
  agentProvider: AgentProvider;
  setFormCompleted: (completed: boolean) => void;
};

type FormValues = {
  name: string;
  description: string;
  endpoint: string;
  apiKey: string;
};

export default function EditAgentProviderForm({
  agentProvider,
  setFormCompleted,
}: Readonly<EditAgentProviderFormProps>) {
  const updateAgentProvider = useUpdateAgentProvider();

  const form = useForm<FormValues>({
    initialValues: {
      name: agentProvider.name,
      description: agentProvider.description,
      endpoint: agentProvider.endpoint,
      apiKey: '',
    },
    validate: {
      name: (value) => (!value.trim() ? 'Name is required' : null),
      endpoint: (value) => {
        if (!value.trim()) { return 'Endpoint is required'; }
        return z.string().url().safeParse(value.trim()).success ? null : 'Must be a valid URL';
      },
    },
  });

  const handleSubmit = (values: FormValues) => {
    updateAgentProvider.mutate({
      id: agentProvider.id,
      name: values.name.trim(),
      description: values.description.trim(),
      endpoint: values.endpoint.trim(),
      apiKey: values.apiKey.trim() || null,
    }, {
      onSuccess: () => {
        setFormCompleted(true);
      },
      onError: (error) => {
        notifications.show({ message: error.message, color: 'red' });
      },
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack spacing='sm'>
        <TextInput
          label='Name'
          required
          {...form.getInputProps('name')}
        />
        <Textarea
          label='Description'
          minRows={2}
          {...form.getInputProps('description')}
        />
        <TextInput
          label='Endpoint'
          required
          {...form.getInputProps('endpoint')}
        />
        <TextInput
          label='API Key'
          placeholder='Enter new key to update, leave blank to keep existing'
          type='password'
          {...form.getInputProps('apiKey')}
        />
        <Group position='right' mt='sm'>
          <Button type='submit' loading={updateAgentProvider.isPending}>
            Save Changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

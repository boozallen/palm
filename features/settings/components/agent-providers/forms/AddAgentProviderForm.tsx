import { z } from 'zod';
import { Button, Group, Stack, TextInput, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import useAddAgentProvider from '@/features/settings/api/agent-providers/add-agent-provider';

type AddAgentProviderFormProps = {
  setFormCompleted: (completed: boolean) => void;
  onCancel?: () => void;
};

type FormValues = {
  name: string;
  description: string;
  endpoint: string;
  apiKey: string;
};

export default function AddAgentProviderForm({ setFormCompleted, onCancel }: Readonly<AddAgentProviderFormProps>) {
  const addAgentProvider = useAddAgentProvider();

  const form = useForm<FormValues>({
    initialValues: {
      name: '',
      description: '',
      endpoint: '',
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
    addAgentProvider.mutate({
      name: values.name.trim(),
      description: values.description.trim(),
      endpoint: values.endpoint.trim(),
      apiKey: values.apiKey.trim() || undefined,
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
          placeholder='My Agent'
          required
          {...form.getInputProps('name')}
        />
        <Textarea
          label='Description'
          placeholder='What this agent does'
          minRows={2}
          {...form.getInputProps('description')}
        />
        <TextInput
          label='Endpoint'
          placeholder='https://agent.example.com'
          required
          {...form.getInputProps('endpoint')}
        />
        <TextInput
          label='API Key'
          placeholder='Optional — leave blank if not required'
          type='password'
          {...form.getInputProps('apiKey')}
        />
        <Group spacing='lg' grow>
          {onCancel && (
            <Button variant='outline' onClick={onCancel} disabled={addAgentProvider.isPending}>
              Cancel
            </Button>
          )}
          <Button type='submit' loading={addAgentProvider.isPending}>
            Add Agent Provider
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

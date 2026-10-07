import { z } from 'zod';
import { Button, Checkbox, Collapse, Group, Stack, TextInput, Textarea, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useUpdateGitHubProvider from '@/features/settings/api/github-providers/update-github-provider';

type EditGitHubProviderFormProps = {
  providerId: string;
  currentLabel: string;
  currentApiBaseUrl: string;
  currentOwner: string;
  currentRepo: string;
  currentDescription: string;
  currentIsSkillRepo: boolean;
  currentSkillRepoBranch: string | null;
  currentSkillRepoServiceUrl: string | null;
  setFormCompleted: (completed: boolean) => void;
};

type FormValues = {
  label: string;
  accessToken: string;
  apiBaseUrl: string;
  owner: string;
  repo: string;
  description: string;
  isSkillRepo: boolean;
  skillRepoBranch: string;
  skillRepoServiceUrl: string;
};

export default function EditGitHubProviderForm({
  providerId,
  currentLabel,
  currentApiBaseUrl,
  currentOwner,
  currentRepo,
  currentDescription,
  currentIsSkillRepo,
  currentSkillRepoBranch,
  currentSkillRepoServiceUrl,
  setFormCompleted,
}: Readonly<EditGitHubProviderFormProps>) {
  const { mutateAsync: updateGitHubProvider, error: updateGitHubProviderError, isPending } = useUpdateGitHubProvider();

  const form = useForm<FormValues>({
    initialValues: {
      label: currentLabel,
      accessToken: '',
      apiBaseUrl: currentApiBaseUrl,
      owner: currentOwner,
      repo: currentRepo,
      description: currentDescription,
      isSkillRepo: currentIsSkillRepo,
      skillRepoBranch: currentSkillRepoBranch || 'main',
      skillRepoServiceUrl: currentSkillRepoServiceUrl || 'http://repo-service:8002',
    },
    validate: {
      label: (value) => (!value.trim() ? 'Label is required' : null),
      apiBaseUrl: (value) => {
        if (!value.trim()) { return 'API base URL is required'; }
        return z.string().url().safeParse(value.trim()).success ? null : 'Must be a valid URL';
      },
      owner: (value) => (!value.trim() ? 'Owner is required' : null),
      repo: (value) => (!value.trim() ? 'Repository is required' : null),
      skillRepoServiceUrl: (value, values) => {
        if (!values.isSkillRepo) { return null; }
        if (!value.trim()) { return 'Service URL is required when Skill Repository is enabled'; }
        return z.string().url().safeParse(value.trim()).success ? null : 'Must be a valid URL';
      },
      skillRepoBranch: (value, values) => {
        if (!values.isSkillRepo) { return null; }
        if (!value.trim()) { return 'Branch is required when Skill Repository is enabled'; }
        return null;
      },
    },
  });

  const handleSubmit = async (values: FormValues) => {
    try {
      await updateGitHubProvider({
        id: providerId,
        label: values.label.trim(),
        accessToken: values.accessToken.trim() || undefined,
        apiBaseUrl: values.apiBaseUrl.trim(),
        owner: values.owner.trim(),
        repo: values.repo.trim(),
        description: values.description.trim(),
        isSkillRepo: values.isSkillRepo,
        skillRepoBranch: values.isSkillRepo ? values.skillRepoBranch.trim() : null,
        skillRepoServiceUrl: values.isSkillRepo ? values.skillRepoServiceUrl.trim() : null,
      });
      setFormCompleted(true);
    } catch (error) {
      notifications.show({
        title: 'Update GitHub Provider Failed',
        message: updateGitHubProviderError?.message ?? 'There was a problem saving your changes',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack spacing='sm'>
        <TextInput
          label='Label'
          placeholder='Production Artifacts'
          required
          {...form.getInputProps('label')}
        />
        <TextInput
          label='Access Token'
          placeholder='Leave blank to keep existing token'
          type='password'
          {...form.getInputProps('accessToken')}
        />
        <Text size='xs' color='dimmed' mt={-8}>
          Leave blank to keep the existing token
        </Text>
        <TextInput
          label='API Base URL'
          placeholder='https://api.github.com'
          required
          {...form.getInputProps('apiBaseUrl')}
        />
        <TextInput
          label='Owner'
          placeholder='myorg'
          required
          {...form.getInputProps('owner')}
        />
        <TextInput
          label='Repository'
          placeholder='my-repo'
          required
          {...form.getInputProps('repo')}
        />
        <Textarea
          label='Description'
          placeholder='What this provider is used for'
          minRows={2}
          {...form.getInputProps('description')}
        />

        <Checkbox
          label='Use as Skill Repository'
          description='Enable this repository as the skill repository for slash command execution'
          {...form.getInputProps('isSkillRepo', { type: 'checkbox' })}
          mt='md'
        />

        <Collapse in={form.values.isSkillRepo}>
          <Stack spacing='sm' mt='sm'>
            <TextInput
              label='Skill Repository Branch'
              placeholder='main'
              description='Branch to clone from this repository'
              {...form.getInputProps('skillRepoBranch')}
            />
            <TextInput
              label='Skill Repository Service URL'
              placeholder='http://repo-service:8002'
              description='URL of the skill repository service'
              {...form.getInputProps('skillRepoServiceUrl')}
            />
          </Stack>
        </Collapse>

        <Group spacing='lg' grow mt='sm'>
          <Button variant='outline' onClick={() => setFormCompleted(true)} disabled={isPending}>
            Cancel
          </Button>
          <Button type='submit' loading={isPending}>
            Update GitHub Provider
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

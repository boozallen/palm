import { Button, Group, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useCreateCertaPolicy from '@/features/settings/api/ai-agents/certa/create-certa-policy';
import useGetPolicyRequirements from '@/features/settings/api/ai-agents/certa/get-policy-requirements';
import { PolicyForm, policyForm } from '@/features/settings/types/ai-agent';
import RequirementsGenerationIcon from '@/features/settings/components/ai-agents/elements/certa/RequirementsGenerationIcon';
import { handleGenerateRequirements } from '@/features/settings/utils/ai-agents/certa/policyRequirements';

type AddPolicyFormProps = Readonly<{
  aiAgentId: string;
  closeForm: React.Dispatch<React.SetStateAction<boolean>>;
}>;
export default function AddPolicyForm({
  aiAgentId,
  closeForm,
}: AddPolicyFormProps) {
  const addPolicyForm = useForm<PolicyForm>({
    initialValues: {
      title: '',
      content: '',
      requirements: '',
    },
    validate: zodResolver(policyForm),
  });

  const {
    mutateAsync: createCertaPolicy,
    isPending: createCertaPolicyIsPending,
    error: createCertaPolicyError,
  } = useCreateCertaPolicy();

  const {
    mutateAsync: generateRequirements,
    isPending: isGeneratingRequirements,
  } = useGetPolicyRequirements();

  const handleGenerateRequirementsClick = () => {
    handleGenerateRequirements(addPolicyForm, generateRequirements);
  };

  const handleSubmit = async (values: PolicyForm) => {
    try {
      await createCertaPolicy({
        ...values,
        title: values.title.trim(),
        content: values.content.trim(),
        requirements: values.requirements.trim(),
        aiAgentId,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Failed to Create Policy',
        message:
          createCertaPolicyError?.message ??
          'There was a problem creating the policy',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    addPolicyForm.reset();
    closeForm(true);
  };

  return (
    <form onSubmit={addPolicyForm.onSubmit(handleSubmit)}>
      <TextInput
        label='Title'
        placeholder='Policy title'
        {...addPolicyForm.getInputProps('title')}
      />
      <Textarea
        label='Content'
        placeholder='Policy content'
        minRows={5}
        maxRows={15}
        autosize
        {...addPolicyForm.getInputProps('content')}
      />
      <Group align='flex-start' noWrap spacing='xs'>
        <Textarea
          label='Requirements'
          placeholder='Policy requirements'
          minRows={5}
          maxRows={15}
          autosize
          sx={{ flexGrow: 1 }}
          {...addPolicyForm.getInputProps('requirements')}
        />
        <RequirementsGenerationIcon
          onClick={handleGenerateRequirementsClick}
          isLoading={isGeneratingRequirements}
          disabled={!addPolicyForm.values.content.trim()}
        />
      </Group>
      <Group spacing='lg' grow mt='md'>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={createCertaPolicyIsPending}>
          {!createCertaPolicyIsPending ? 'Add Policy' : 'Adding Policy'}
        </Button>
      </Group>
    </form>
  );
}

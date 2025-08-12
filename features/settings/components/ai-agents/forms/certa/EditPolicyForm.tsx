import { Button, Group, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateCertaPolicy from '@/features/settings/api/ai-agents/certa/update-certa-policy';
import useGetPolicyRequirements from '@/features/settings/api/ai-agents/certa/get-policy-requirements';
import { PolicyForm, policyForm } from '@/features/settings/types';
import RequirementsGenerationIcon from '@/features/settings/components/ai-agents/elements/certa/RequirementsGenerationIcon';
import { handleGenerateRequirements } from '@/features/settings/utils/ai-agents/certa/policyRequirements';

type EditPolicyFormProps = Readonly<{
  policyId: string;
  initialValues: PolicyForm;
  closeForm: React.Dispatch<React.SetStateAction<boolean>>;
}>;

export default function EditPolicyForm({
  policyId,
  initialValues,
  closeForm,
}: EditPolicyFormProps) {
  const editPolicyForm = useForm<PolicyForm>({
    initialValues,
    validate: zodResolver(policyForm),
  });

  const {
    mutateAsync: updateCertaPolicy,
    isPending: updateCertaPolicyIsPending,
    error: updateCertaPolicyError,
  } = useUpdateCertaPolicy();

  const {
    mutateAsync: generateRequirements,
    isPending: isGeneratingRequirements,
  } = useGetPolicyRequirements();

  const handleGenerateRequirementsClick = () => {
    handleGenerateRequirements(editPolicyForm, generateRequirements);
  };

  const handleSubmit = async (values: PolicyForm) => {
    try {
      await updateCertaPolicy({
        id: policyId,
        title: values.title.trim(),
        content: values.content.trim(),
        requirements: values.requirements.trim(),
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Failed to Update Policy',
        message:
          updateCertaPolicyError?.message ??
          'There was a problem updating the policy',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    editPolicyForm.reset();
    closeForm(true);
  };

  return (
    <form onSubmit={editPolicyForm.onSubmit(handleSubmit)}>
      <TextInput
        label='Title'
        placeholder='Policy title'
        {...editPolicyForm.getInputProps('title')}
      />
      <Textarea
        label='Content'
        placeholder='Policy content'
        minRows={5}
        maxRows={15}
        autosize
        {...editPolicyForm.getInputProps('content')}
      />
      <Group align='flex-start' noWrap spacing='xs'>
        <Textarea
          label='Requirements'
          placeholder='Policy requirements'
          minRows={5}
          maxRows={15}
          autosize
          sx={{ flexGrow: 1 }}
          {...editPolicyForm.getInputProps('requirements')}
        />
        <RequirementsGenerationIcon
          onClick={handleGenerateRequirementsClick}
          isLoading={isGeneratingRequirements}
          disabled={!editPolicyForm.values.content.trim()}
        />
      </Group>
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={updateCertaPolicyIsPending}>
          {!updateCertaPolicyIsPending ? 'Save Changes' : 'Saving Changes'}
        </Button>
      </Group>
    </form>
  );
}

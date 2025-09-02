import { useState } from 'react';
import { Button, Center, Grid, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { SystemConfigFields, legalPolicySchema } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';

type EditLegalPolicyFormValues = Readonly<{
  legalPolicyHeader: string;
  legalPolicyBody: string;
}>;

type FieldChange = {
  fieldName: keyof EditLegalPolicyFormValues;
  newValue: string;
};

export default function EditLegalPolicyForm({ legalPolicyHeader, legalPolicyBody }: EditLegalPolicyFormValues) {

  const {
    mutateAsync: updateSystemConfig,
    isPending: updateSystemConfigIsPending,
    error: updateSystemConfigError,
  } = useUpdateSystemConfig();

  const legalPolicyForm = useForm<EditLegalPolicyFormValues>({
    initialValues: {
      legalPolicyHeader: legalPolicyHeader,
      legalPolicyBody: legalPolicyBody,
    },
    validate: zodResolver(legalPolicySchema),
  });

  const [initialValues, setInitialValues] = useState<EditLegalPolicyFormValues>(legalPolicyForm.values);

  const handleSubmit = async (values: EditLegalPolicyFormValues) => {
    // Create an array of fields that have changed from their initial values
    const changedFields: FieldChange[] = Object.keys(values)
      .filter((fieldName) => values[fieldName as keyof EditLegalPolicyFormValues] !== initialValues[fieldName as keyof EditLegalPolicyFormValues])
      .map((fieldName) => ({
        fieldName: fieldName as keyof EditLegalPolicyFormValues,
        newValue: values[fieldName as keyof EditLegalPolicyFormValues],
      }));

    try {
      const updatePayload = changedFields.map(field => ({
        configField: field.fieldName === 'legalPolicyHeader' ? SystemConfigFields.LegalPolicyHeader : SystemConfigFields.LegalPolicyBody,
        configValue: field.newValue,
      }));

      await Promise.all(
        updatePayload.map(payload => updateSystemConfig(payload))
      );

      notifications.show({
        title: 'Legal Policy Updated',
        message: 'Legal Policy has been successfully updated',
        variant: 'successful_operation',
        icon: <IconCheck />,
        autoClose: true,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Update System Configuration Failed',
        message: updateSystemConfigError?.message ?? 'There was a problem updating the legal policy',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  function handleFormCompletion() {
    legalPolicyForm.resetDirty();
    setInitialValues(legalPolicyForm.values);
  }

  return (
    <form onSubmit={legalPolicyForm.onSubmit(handleSubmit)} data-testid='edit-legal-policy-form'>
      <Grid>
        <Grid.Col span={10}>
          <TextInput
            label={'Header'}
            aria-label='Edit legal policy header here'
            data-testid='legal-policy-header-textarea'
            mb={'0'}
            p={0}
            radius={'xs'}
            variant='default'
            {...legalPolicyForm.getInputProps('legalPolicyHeader')}
          />
        </Grid.Col>
        <Grid.Col span={10}>
          <Textarea
            label={'Body'}
            aria-label='Edit legal policy body here'
            data-testid='legal-policy-body-textarea'
            mb={'0'}
            p={0}
            radius={'xs'}
            autosize
            minRows={1}
            maxRows={15}
            variant='default'
            styles={(theme) => ({
              input: {
                paddingTop: `${theme.spacing.sm}!important`,
                paddingBottom: `${theme.spacing.sm}!important`,
              },
            })}
            {...legalPolicyForm.getInputProps('legalPolicyBody')}
          />
        </Grid.Col>
        <Grid.Col span={2} pt={'xl'}>
          <Center>
            <Button
              type='submit'
              data-testid='legal-policy-submit-button'
              disabled={!legalPolicyForm.isDirty()}
              loading={updateSystemConfigIsPending}>
              {updateSystemConfigIsPending ? 'Updating' : 'Update'}
            </Button>
          </Center>
        </Grid.Col>
      </Grid>
    </form>
  );
}


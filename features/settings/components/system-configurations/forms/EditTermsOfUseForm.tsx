import { useState } from 'react';
import { Button, Center, Grid, Textarea, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { SystemConfigFields, termsOfUseSchema } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';

type EditTermsOfUseFormValues = Readonly<{
  termsOfUseHeader: string;
  termsOfUseBody: string;
  termsOfUseCheckboxLabel: string;
}>;

type FieldChange = {
  fieldName: keyof EditTermsOfUseFormValues;
  newValue: string;
};

export default function EditTermsOfUseForm({ termsOfUseHeader, termsOfUseBody, termsOfUseCheckboxLabel }: EditTermsOfUseFormValues) {

  const {
    mutate: updateSystemConfig,
    isPending: updateSystemConfigIsPending,
    error: updateSystemConfigError,
  } = useUpdateSystemConfig();

  const termsOfUseForm = useForm<EditTermsOfUseFormValues>({
    initialValues: {
      termsOfUseHeader: termsOfUseHeader,
      termsOfUseBody: termsOfUseBody,
      termsOfUseCheckboxLabel: termsOfUseCheckboxLabel,
    },
    validate: zodResolver(termsOfUseSchema),
  });

  const [initialValues, setInitialValues] = useState<EditTermsOfUseFormValues>(termsOfUseForm.values);

  const handleSubmit = async (values: EditTermsOfUseFormValues) => {
    let config: SystemConfigFields;

    // Create an array of fields that have changed from their initial values
    const changedFields: FieldChange[] = Object.keys(values)
      .filter((fieldName) => values[fieldName as keyof EditTermsOfUseFormValues] !== initialValues[fieldName as keyof EditTermsOfUseFormValues])
      .map((fieldName) => ({
        fieldName: fieldName as keyof EditTermsOfUseFormValues,
        newValue: values[fieldName as keyof EditTermsOfUseFormValues],
      }));

    try {
      changedFields.forEach((fieldName) => {
        switch (fieldName.fieldName) {
          case 'termsOfUseHeader':
            config = SystemConfigFields.TermsOfUseHeader;
            break;
          case 'termsOfUseBody':
            config = SystemConfigFields.TermsOfUseBody;
            break;
          case 'termsOfUseCheckboxLabel':
            config = SystemConfigFields.TermsOfUseCheckboxLabel;
            break;
        }

        updateSystemConfig({
          configField: config,
          configValue: fieldName.newValue,
        }, {
          onSuccess: () => {
            notifications.show({
              title: 'Terms of Use Banner Updated',
              message: 'The terms of use banner has been updated successfully.',
              variant: 'successful_operation',
              icon: <IconCheck />,
              autoClose: true,
            });
          },
        });
        handleFormCompletion();
      });
    } catch (error) {
      notifications.show({
        title: 'Update System Configuration Failed',
        message: updateSystemConfigError?.message ?? 'There was a problem updating the terms of use banner',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  function handleFormCompletion() {
    termsOfUseForm.resetDirty();
    setInitialValues(termsOfUseForm.values);
  }

  return (
    <form onSubmit={termsOfUseForm.onSubmit(handleSubmit)}>
      <Grid>
        <Grid.Col span={10}>
          <TextInput
            label={'Header'}
            aria-label='Edit terms of use header here'
            data-testid='terms-of-use-header-textarea'
            mb={'0'}
            p={0}
            radius={'xs'}
            variant='default'
            {...termsOfUseForm.getInputProps('termsOfUseHeader')}
          />
        </Grid.Col>
        <Grid.Col span={10}>
          <Textarea
            label={'Body'}
            aria-label='Edit terms of use body here'
            data-testid='terms-of-use-body-textarea'
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
            {...termsOfUseForm.getInputProps('termsOfUseBody')}

          />
        </Grid.Col>
        <Grid.Col span={2} pt={'xl'}>
          <Center>
            <Button
              type='submit'
              data-testid='submit'
              disabled={!termsOfUseForm.isDirty()}
              loading={updateSystemConfigIsPending}>
              {updateSystemConfigIsPending ? 'Updating' : 'Update'}
            </Button>
          </Center>
        </Grid.Col>
        <Grid.Col span={10}>
          <TextInput
            label={'Checkbox Label'}
            aria-label='Edit terms of use checkbox label here'
            data-testid='terms-of-use-checkbox-label-textarea'
            mb={'0'}
            p={0}
            radius={'xs'}
            variant='default'
            {...termsOfUseForm.getInputProps('termsOfUseCheckboxLabel')}
          />
        </Grid.Col>
      </Grid>
    </form>
  );
}

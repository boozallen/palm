import { useState } from 'react';
import { Button, Center, Grid, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { SystemConfigFields, joinUserGroupDialogSchema } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';

type EditJoinUserGroupDialogFormValues = Readonly<{
  joinUserGroupDialogExternalLink: string;
}>;

export default function EditJoinUserGroupDialogForm({ joinUserGroupDialogExternalLink }: EditJoinUserGroupDialogFormValues) {

  const {
    mutateAsync: updateSystemConfig,
    isPending: updateSystemConfigIsPending,
    error: updateSystemConfigError,
  } = useUpdateSystemConfig();

  const joinUserGroupDialogForm = useForm<EditJoinUserGroupDialogFormValues>({
    initialValues: {
      joinUserGroupDialogExternalLink: joinUserGroupDialogExternalLink,
    },
    validate: zodResolver(joinUserGroupDialogSchema),
  });

  const [initialValues, setInitialValues] = useState<EditJoinUserGroupDialogFormValues>(joinUserGroupDialogForm.values);

  const handleSubmit = async (values: EditJoinUserGroupDialogFormValues) => {
    if (values.joinUserGroupDialogExternalLink === initialValues.joinUserGroupDialogExternalLink) {
      return;
    }

    try {
      await updateSystemConfig({
        configField: SystemConfigFields.JoinUserGroupDialogExternalLink,
        configValue: values.joinUserGroupDialogExternalLink.trim(),
      });

      notifications.show({
        title: 'Join User Group Dialog Updated',
        message: 'The join user group dialog link has been successfully updated',
        variant: 'successful_operation',
        icon: <IconCheck />,
        autoClose: true,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Update System Configuration Failed',
        message: updateSystemConfigError?.message ?? 'There was a problem updating the join user group dialog link',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  function handleFormCompletion() {
    joinUserGroupDialogForm.resetDirty();
    setInitialValues(joinUserGroupDialogForm.values);
  }

  return (
    <form onSubmit={joinUserGroupDialogForm.onSubmit(handleSubmit)} data-testid='edit-join-user-group-dialog-form'>
      <Grid>
        <Grid.Col span={10}>
          <TextInput
            label={'Request Access Link'}
            description='External URL shown in the join user group dialog. Leave blank to hide the link.'
            aria-label='Edit join user group dialog request access link here'
            data-testid='join-user-group-dialog-external-link-input'
            mb={'0'}
            p={0}
            radius={'xs'}
            variant='default'
            {...joinUserGroupDialogForm.getInputProps('joinUserGroupDialogExternalLink')}
          />
        </Grid.Col>
        <Grid.Col span={2} pt={'xl'}>
          <Center>
            <Button
              type='submit'
              data-testid='join-user-group-dialog-submit-button'
              disabled={!joinUserGroupDialogForm.isDirty()}
              loading={updateSystemConfigIsPending}>
              {updateSystemConfigIsPending ? 'Updating' : 'Update'}
            </Button>
          </Center>
        </Grid.Col>
      </Grid>
    </form>
  );
}

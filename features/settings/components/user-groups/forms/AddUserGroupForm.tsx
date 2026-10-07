import { Dispatch, SetStateAction } from 'react';
import { Button, Group, TextInput } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import useCreateUserGroup from '@/features/settings/api/user-groups/create-user-group';
import {
  UserGroupForm,
  userGroupFormSchema,
} from '@/features/shared/types/user-group';

export type AddUserGroupFormProps = Readonly<{
  setFormCompleted: Dispatch<SetStateAction<boolean>>;
}>;

export default function AddUserGroupForm({
  setFormCompleted,
}: AddUserGroupFormProps) {
  const {
    mutateAsync: createUserGroup,
    isPending: createUserGroupIsPending,
    error: createUserGroupBaseError,
  } = useCreateUserGroup();

  const addUserGroupForm = useForm<UserGroupForm>({
    initialValues: {
      label: '',
    },
    validate: zodResolver(userGroupFormSchema),
  });

  const handleSubmit = async (values: UserGroupForm) => {
    const sanitizedValues: UserGroupForm = {
      label: values.label.trim(),
    };

    try {
      await createUserGroup(sanitizedValues);
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        id: 'create-user-group-error',
        title: 'Failed to Add User Group',
        message: (error as Error).message ?? createUserGroupBaseError?.message ?? 'Unable to add a user group at this time. Please try again later',
        icon: <IconX />,
        autoClose: false,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    addUserGroupForm.reset();
    setFormCompleted(true);
  };

  return (
    <form
      onSubmit={addUserGroupForm.onSubmit(handleSubmit)}
      data-testid='add-user-group-form'
    >
      <TextInput
        label='Label'
        placeholder='Enter a Label'
        {...addUserGroupForm.getInputProps('label')}
      />
      <Group spacing='lg' grow>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={createUserGroupIsPending}>
          {createUserGroupIsPending ? 'Adding' : 'Add Group'}
        </Button>
      </Group>
    </form>
  );
}
